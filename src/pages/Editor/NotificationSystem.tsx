import type { JSX } from "react/jsx-runtime"
import { useEffect, useCallback } from "react"
import { Notyf } from "notyf"
import "notyf/notyf.min.css"

// 声明全局类型
declare global {
  interface Window {
    showNotification?: (type: string, message: string) => void
  }
}

// 通知系统组件
export function NotificationSystem(): JSX.Element {
  useEffect(() => {
    // 初始化notyf
    const notyf = new Notyf({
      position: {
        x: "right",
        y: "bottom"
      },
      types: [
        {
          type: "success",
          background: "#10B981"
        },
        {
          type: "warning",
          background: "#F59E0B"
        },
        {
          type: "error",
          background: "#EF4444"
        },
        {
          type: "info",
          background: "#3B82F6"
        }
      ]
    })

    // 暴露给全局使用
    window.showNotification = (type: string, message: string): void => {
      notyf.open({
        type,
        message,
        duration: 3000
      })
    }

    return () => {
      // 清理所有通知
      notyf.dismissAll()
    }
  }, [])

  return null
}
