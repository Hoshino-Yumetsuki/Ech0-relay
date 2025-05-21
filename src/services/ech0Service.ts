import axios from 'axios'
import { ConnectInfo, Ech0Response, InstanceInfo } from '../types'
import { MongoDB } from '../db/mongodb'

/**
 * Ech0 服务类
 * 负责与远程 Ech0 实例交互并管理实例数据
 */
export class Ech0Service {
  private db: MongoDB

  /**
   * 创建 Ech0 服务
   * @param db MongoDB 实例
   */
  constructor(db: MongoDB) {
    this.db = db
  }

  /**
   * 获取 Ech0 实例的连接信息
   * @param url Ech0 实例 URL
   * @returns 连接信息
   */
  async fetchConnectInfo(url: string): Promise<Ech0Response<ConnectInfo>> {
    try {
      // 规范化 URL
      const normalizedUrl = this.normalizeUrl(url)
      const connectUrl = `${normalizedUrl}/api/connect`

      // 发送请求获取连接信息
      const response = await axios.get<Ech0Response<ConnectInfo>>(connectUrl)

      if (response.data && response.data.code === 1) {
        return response.data
      }

      throw new Error(`从 ${url} 获取连接信息失败: ${response.data.msg}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      throw new Error(`获取连接信息失败: ${errorMessage}`)
    }
  }

  /**
   * 保存实例信息到数据库
   * @param serverUrl 服务器 URL
   * @param connectInfo 连接信息
   */
  async saveInstance(
    serverUrl: string,
    connectInfo: Ech0Response<ConnectInfo>
  ): Promise<void> {
    const normalizedUrl = this.normalizeUrl(serverUrl)

    const instanceInfo: InstanceInfo = {
      server_url: normalizedUrl,
      last_updated: new Date(),
      connect_info: connectInfo
    }

    await this.db.saveInstance(instanceInfo)
  }

  /**
   * 从数据库获取所有实例的连接信息
   * @returns 所有实例的连接信息
   */
  async getAllInstances(): Promise<Ech0Response<ConnectInfo>[]> {
    const instances = await this.db.getAllInstances()
    return instances.map((instance) => instance.connect_info)
  }

  /**
   * 从数据库中移除指定实例
   * @param serverUrl 服务器 URL
   * @returns 是否成功移除
   */
  async removeInstance(serverUrl: string): Promise<boolean> {
    const normalizedUrl = this.normalizeUrl(serverUrl)
    return await this.db.removeInstance(normalizedUrl)
  }

  /**
   * 检查数据库中是否存在指定实例
   * @param serverUrl 服务器 URL
   * @returns 是否存在
   */
  async hasInstance(serverUrl: string): Promise<boolean> {
    const normalizedUrl = this.normalizeUrl(serverUrl)
    const instance = await this.db.getInstance(normalizedUrl)
    return instance !== null
  }

  /**
   * 规范化 URL
   * @param url 输入 URL
   * @returns 规范化后的 URL
   */
  private normalizeUrl(url: string): string {
    // 移除尾部斜杠
    return url.endsWith('/') ? url.slice(0, -1) : url
  }
}
