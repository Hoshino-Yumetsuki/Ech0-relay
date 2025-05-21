/**
 * Ech0 连接信息类型
 */
export interface ConnectInfo {
  server_name: string
  server_url: string
  logo: string
  ech0s: number
  sys_username: string
}

/**
 * Ech0 API 响应格式
 */
export interface Ech0Response<T> {
  code: number
  msg: string
  data: T
}

/**
 * 数据库中存储的实例信息
 */
export interface InstanceInfo {
  server_url: string
  last_updated: Date
  connect_info: Ech0Response<ConnectInfo>
  /**
   * 检测失败次数，用于查活功能
   * 连续两次检测失败则从数据库中删除
   */
  failure_count?: number
}
