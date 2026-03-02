import type { JSX } from "react/jsx-runtime"
import { useState, useEffect, useCallback } from "react"

// 声明全局类型
declare global {
  interface Window {
    showNotification?: (type: string, message: string) => void
  }
}

// 通知系统组件
export function NotificationSystem(): JSX.Element {
  const [notifications, setNotifications] = useState<Array<{ id: number; type: string; message: string }>>([])

  const addNotification = useCallback((type: string, message: string): void => {
    const id = Date.now()
    setNotifications((prev) => [...prev, { id, type, message }])
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    }, 3000)
  }, [])

  // 暴露给全局使用
  useEffect(() => {
    window.showNotification = addNotification
  }, [addNotification])

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`px-4 py-2 rounded-lg text-white font-medium shadow-lg transition-all duration-300 ${
            notification.type === "success"
              ? "bg-green-500"
              : notification.type === "warning"
                ? "bg-yellow-500"
                : notification.type === "error"
                  ? "bg-red-500"
                  : "bg-blue-500"
          }`}
        >
          {notification.message}
        </div>
      ))}
    </div>
  )
}
