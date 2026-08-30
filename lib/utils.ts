import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 子路径部署（NEXT_PUBLIC_BASE_PATH，如 /vibehard）时，public 下的静态资源需要手动加前缀。
// next/link 与 router 会自动处理 basePath，但 <img>/<Image unoptimized>/iframe 的绝对 src 不会。
export function assetPath(p: string) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? ""
  return `${base}${p}`
}

export function apiPath(p: string) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? ""
  return `${base}${p}`
}
