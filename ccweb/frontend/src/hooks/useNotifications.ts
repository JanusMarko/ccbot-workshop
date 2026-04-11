import { useCallback, useEffect, useRef } from "react";

export function useNotifications() {
  const permissionRef = useRef(
    typeof Notification !== "undefined" ? Notification.permission : "denied",
  );

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      Notification.requestPermission().then((perm) => {
        permissionRef.current = perm;
      });
    }
  }, []);

  const notify = useCallback((title: string, body?: string) => {
    if (typeof Notification === "undefined") return;
    if (permissionRef.current !== "granted") return;
    // Only notify when tab is not focused
    if (document.hasFocus()) return;

    const n = new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: "ccweb", // Replace previous notification
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  }, []);

  return { notify };
}
