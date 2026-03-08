"""Tests for SessionManager pure dict operations."""

import json

import pytest

from ccbot.session import ClaudeSession, SessionManager


@pytest.fixture
def mgr(monkeypatch) -> SessionManager:
    monkeypatch.setattr(SessionManager, "_load_state", lambda self: None)
    monkeypatch.setattr(SessionManager, "_save_state", lambda self: None)
    return SessionManager()


class TestThreadBindings:
    def test_bind_and_get(self, mgr: SessionManager) -> None:
        mgr.bind_thread(100, 1, "@1")
        assert mgr.get_window_for_thread(100, 1) == "@1"

    def test_bind_unbind_get_returns_none(self, mgr: SessionManager) -> None:
        mgr.bind_thread(100, 1, "@1")
        mgr.unbind_thread(100, 1)
        assert mgr.get_window_for_thread(100, 1) is None

    def test_unbind_nonexistent_returns_none(self, mgr: SessionManager) -> None:
        assert mgr.unbind_thread(100, 999) is None

    def test_all_thread_bindings(self, mgr: SessionManager) -> None:
        mgr.bind_thread(100, 1, "@1")
        mgr.bind_thread(100, 2, "@2")
        mgr.bind_thread(200, 3, "@3")
        result = set(mgr.all_thread_bindings())
        assert result == {(100, 1, "@1"), (100, 2, "@2"), (200, 3, "@3")}

    def test_all_thread_bindings_returns_list(self, mgr: SessionManager) -> None:
        """all_thread_bindings must return a list (snapshot), not a generator.

        A generator would hold a live reference into the internal dict and could
        raise RuntimeError if an async coroutine calls unbind_thread between two
        consumed values.  A list snapshot is safe across await points.
        """
        mgr.bind_thread(100, 1, "@1")
        result = mgr.all_thread_bindings()
        assert isinstance(result, list)

    def test_all_thread_bindings_snapshot_is_independent(
        self, mgr: SessionManager
    ) -> None:
        """Mutating thread_bindings after calling all_thread_bindings must not
        affect the already-returned snapshot."""
        mgr.bind_thread(100, 1, "@1")
        mgr.bind_thread(100, 2, "@2")
        snapshot = mgr.all_thread_bindings()
        # Mutate the live dict after snapshot was taken — the snapshot must
        # be unaffected (this is the property that prevents RuntimeError
        # when unbind_thread runs between await points in async callers)
        mgr.unbind_thread(100, 1)
        assert (100, 1, "@1") in snapshot
        assert len(snapshot) == 2

    def test_all_thread_bindings_empty(self, mgr: SessionManager) -> None:
        """all_thread_bindings returns an empty list when nothing is bound."""
        result = mgr.all_thread_bindings()
        assert result == []


class TestGroupChatId:
    """Tests for group chat_id routing (supergroup forum topic support).

    IMPORTANT: These tests protect against regression. The group_chat_ids
    mapping is required for Telegram supergroup forum topics — without it,
    all outbound messages fail with "Message thread not found". This was
    erroneously removed once (26cb81f) and restored in PR #23. Do NOT
    delete these tests or the underlying functionality.
    """

    def test_resolve_with_stored_group_id(self, mgr: SessionManager) -> None:
        """resolve_chat_id returns stored group chat_id for known thread."""
        mgr.set_group_chat_id(100, 1, -1001234567890)
        assert mgr.resolve_chat_id(100, 1) == -1001234567890

    def test_resolve_without_group_id_falls_back_to_user_id(
        self, mgr: SessionManager
    ) -> None:
        """resolve_chat_id falls back to user_id when no group_id stored."""
        assert mgr.resolve_chat_id(100, 1) == 100

    def test_resolve_none_thread_id_falls_back_to_user_id(
        self, mgr: SessionManager
    ) -> None:
        """resolve_chat_id returns user_id when thread_id is None (private chat)."""
        mgr.set_group_chat_id(100, 1, -1001234567890)
        assert mgr.resolve_chat_id(100) == 100

    def test_set_group_chat_id_overwrites(self, mgr: SessionManager) -> None:
        """set_group_chat_id updates the stored value on change."""
        mgr.set_group_chat_id(100, 1, -999)
        mgr.set_group_chat_id(100, 1, -888)
        assert mgr.resolve_chat_id(100, 1) == -888

    def test_multiple_threads_independent(self, mgr: SessionManager) -> None:
        """Different threads for the same user store independent group chat_ids."""
        mgr.set_group_chat_id(100, 1, -111)
        mgr.set_group_chat_id(100, 2, -222)
        assert mgr.resolve_chat_id(100, 1) == -111
        assert mgr.resolve_chat_id(100, 2) == -222

    def test_multiple_users_independent(self, mgr: SessionManager) -> None:
        """Different users store independent group chat_ids."""
        mgr.set_group_chat_id(100, 1, -111)
        mgr.set_group_chat_id(200, 1, -222)
        assert mgr.resolve_chat_id(100, 1) == -111
        assert mgr.resolve_chat_id(200, 1) == -222

    def test_set_group_chat_id_with_none_thread(self, mgr: SessionManager) -> None:
        """set_group_chat_id handles None thread_id (mapped to 0)."""
        mgr.set_group_chat_id(100, None, -999)
        # thread_id=None in resolve falls back to user_id (by design)
        assert mgr.resolve_chat_id(100, None) == 100
        # The stored key is "100:0", only accessible with explicit thread_id=0
        assert mgr.group_chat_ids.get("100:0") == -999


class TestWindowState:
    def test_get_creates_new(self, mgr: SessionManager) -> None:
        state = mgr.get_window_state("@0")
        assert state.session_id == ""
        assert state.cwd == ""

    def test_get_returns_existing(self, mgr: SessionManager) -> None:
        state = mgr.get_window_state("@1")
        state.session_id = "abc"
        assert mgr.get_window_state("@1").session_id == "abc"

    def test_clear_window_session(self, mgr: SessionManager) -> None:
        state = mgr.get_window_state("@1")
        state.session_id = "abc"
        mgr.clear_window_session("@1")
        assert mgr.get_window_state("@1").session_id == ""


class TestResolveWindowForThread:
    def test_none_thread_id_returns_none(self, mgr: SessionManager) -> None:
        assert mgr.resolve_window_for_thread(100, None) is None

    def test_unbound_thread_returns_none(self, mgr: SessionManager) -> None:
        assert mgr.resolve_window_for_thread(100, 42) is None

    def test_bound_thread_returns_window(self, mgr: SessionManager) -> None:
        mgr.bind_thread(100, 42, "@3")
        assert mgr.resolve_window_for_thread(100, 42) == "@3"


class TestDisplayNames:
    def test_get_display_name_fallback(self, mgr: SessionManager) -> None:
        """get_display_name returns window_id when no display name is set."""
        assert mgr.get_display_name("@99") == "@99"

    def test_set_and_get_display_name(self, mgr: SessionManager) -> None:
        mgr.bind_thread(100, 1, "@1", window_name="myproject")
        assert mgr.get_display_name("@1") == "myproject"

    def test_set_display_name_update(self, mgr: SessionManager) -> None:
        mgr.bind_thread(100, 1, "@1", window_name="old-name")
        mgr.window_display_names["@1"] = "new-name"
        assert mgr.get_display_name("@1") == "new-name"

    def test_bind_thread_sets_display_name(self, mgr: SessionManager) -> None:
        mgr.bind_thread(100, 1, "@1", window_name="proj")
        assert mgr.get_display_name("@1") == "proj"

    def test_bind_thread_without_name_no_display(self, mgr: SessionManager) -> None:
        mgr.bind_thread(100, 1, "@1")
        # No display name set, fallback to window_id
        assert mgr.get_display_name("@1") == "@1"


class TestIsWindowId:
    def test_valid_ids(self, mgr: SessionManager) -> None:
        assert mgr._is_window_id("@0") is True
        assert mgr._is_window_id("@12") is True
        assert mgr._is_window_id("@999") is True

    def test_invalid_ids(self, mgr: SessionManager) -> None:
        assert mgr._is_window_id("myproject") is False
        assert mgr._is_window_id("@") is False
        assert mgr._is_window_id("") is False
        assert mgr._is_window_id("@abc") is False


def _make_jsonl_entry(
    msg_type: str,
    content: list,
    session_id: str = "test-session",
) -> str:
    """Build a JSONL line for testing."""
    return json.dumps(
        {
            "type": msg_type,
            "timestamp": "2026-03-07T20:00:00.000Z",
            "sessionId": session_id,
            "cwd": "/tmp/test",
            "message": {"content": content},
        }
    )


class TestGetSessionDeathContext:
    """Tests for get_session_death_context — crash diagnostics from JSONL."""

    @pytest.mark.asyncio
    async def test_returns_last_tool_use(self, mgr: SessionManager, tmp_path) -> None:
        """Shows the last tool that was running when session died."""
        jsonl = tmp_path / "session.jsonl"
        lines = [
            _make_jsonl_entry(
                "assistant",
                [{"type": "text", "text": "Let me read the file."}],
            ),
            _make_jsonl_entry(
                "assistant",
                [
                    {
                        "type": "tool_use",
                        "id": "tool_1",
                        "name": "Bash",
                        "input": {"command": "npm run test:e2e"},
                    }
                ],
            ),
            # No tool_result — tool was mid-execution when session died
        ]
        jsonl.write_text("\n".join(lines) + "\n")

        # Mock resolve_session_for_window to return our test file
        async def mock_resolve(wid):
            return ClaudeSession(
                session_id="test",
                summary="",
                message_count=2,
                file_path=str(jsonl),
            )

        mgr.resolve_session_for_window = mock_resolve  # type: ignore[assignment]
        result = await mgr.get_session_death_context("@1")

        assert "Last activity:" in result
        assert "Running:" in result
        assert "Bash" in result
        assert "npm run test:e2e" in result

    @pytest.mark.asyncio
    async def test_returns_last_text_message(
        self, mgr: SessionManager, tmp_path
    ) -> None:
        """Shows the last assistant text message."""
        jsonl = tmp_path / "session.jsonl"
        lines = [
            _make_jsonl_entry(
                "assistant",
                [{"type": "text", "text": "All 4 test agents running."}],
            ),
        ]
        jsonl.write_text("\n".join(lines) + "\n")

        async def mock_resolve(wid):
            return ClaudeSession(
                session_id="test",
                summary="",
                message_count=1,
                file_path=str(jsonl),
            )

        mgr.resolve_session_for_window = mock_resolve  # type: ignore[assignment]
        result = await mgr.get_session_death_context("@1")

        assert "Last message:" in result
        assert "All 4 test agents running." in result

    @pytest.mark.asyncio
    async def test_returns_empty_for_missing_session(self, mgr: SessionManager) -> None:
        """Returns empty string when session can't be resolved."""

        async def mock_resolve(wid):
            return None

        mgr.resolve_session_for_window = mock_resolve  # type: ignore[assignment]
        result = await mgr.get_session_death_context("@1")
        assert result == ""

    @pytest.mark.asyncio
    async def test_returns_empty_for_missing_file(self, mgr: SessionManager) -> None:
        """Returns empty string when JSONL file doesn't exist."""

        async def mock_resolve(wid):
            return ClaudeSession(
                session_id="test",
                summary="",
                message_count=0,
                file_path="/nonexistent/path.jsonl",
            )

        mgr.resolve_session_for_window = mock_resolve  # type: ignore[assignment]
        result = await mgr.get_session_death_context("@1")
        assert result == ""

    @pytest.mark.asyncio
    async def test_truncates_long_messages(self, mgr: SessionManager, tmp_path) -> None:
        """Long assistant text is truncated to ~200 chars."""
        jsonl = tmp_path / "session.jsonl"
        long_text = "x" * 500
        lines = [
            _make_jsonl_entry(
                "assistant",
                [{"type": "text", "text": long_text}],
            ),
        ]
        jsonl.write_text("\n".join(lines) + "\n")

        async def mock_resolve(wid):
            return ClaudeSession(
                session_id="test",
                summary="",
                message_count=1,
                file_path=str(jsonl),
            )

        mgr.resolve_session_for_window = mock_resolve  # type: ignore[assignment]
        result = await mgr.get_session_death_context("@1")

        assert "..." in result
        # The truncated text should be at most 200 chars + "..."
        for line in result.split("\n"):
            if "Last message:" in line:
                # Extract the quoted message content
                msg_part = line.split('"')[1] if '"' in line else ""
                assert len(msg_part) <= 204  # 200 + "..."

    @pytest.mark.asyncio
    async def test_completed_tool_shows_last_tool(
        self, mgr: SessionManager, tmp_path
    ) -> None:
        """When tool completed (has result), shows as 'Last tool' not 'Running'."""
        jsonl = tmp_path / "session.jsonl"
        lines = [
            _make_jsonl_entry(
                "assistant",
                [
                    {
                        "type": "tool_use",
                        "id": "tool_1",
                        "name": "Read",
                        "input": {"file_path": "src/main.py"},
                    }
                ],
            ),
            _make_jsonl_entry(
                "user",
                [
                    {
                        "type": "tool_result",
                        "tool_use_id": "tool_1",
                        "content": "file contents here",
                    }
                ],
            ),
        ]
        jsonl.write_text("\n".join(lines) + "\n")

        async def mock_resolve(wid):
            return ClaudeSession(
                session_id="test",
                summary="",
                message_count=2,
                file_path=str(jsonl),
            )

        mgr.resolve_session_for_window = mock_resolve  # type: ignore[assignment]
        result = await mgr.get_session_death_context("@1")

        assert "Last tool:" in result
        assert "Running:" not in result
