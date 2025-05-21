import { MongoClient, Collection } from 'mongodb'
import { InstanceInfo } from '../types'

/**
 * MongoDB 客户端连接类
 */
export class MongoDB {
  private client: MongoClient
  private dbName: string
  private instancesCollection: Collection<InstanceInfo> | null = null

  /**
   * 创建 MongoDB 连接
   * @param uri MongoDB 连接字符串
   * @param dbName 数据库名称
   */
  constructor(uri: string, dbName: string = 'ech0_relay') {
    this.client = new MongoClient(uri)
    this.dbName = dbName
  }

  /**
   * 连接到 MongoDB
   */
  async connect(): Promise<void> {
    try {
      await this.client.connect()
      console.log('MongoDB 连接成功')

      const db = this.client.db(this.dbName)
      this.instancesCollection = db.collection<InstanceInfo>('instances')

      // 创建 server_url 索引确保唯一性
      await this.instancesCollection.createIndex(
        { server_url: 1 },
        { unique: true }
      )
    } catch (error) {
      console.error('MongoDB 连接失败:', error)
      throw error
    }
  }

  /**
   * 断开 MongoDB 连接
   */
  async disconnect(): Promise<void> {
    try {
      await this.client.close()
      console.log('MongoDB 连接已关闭')
    } catch (error) {
      console.error('MongoDB 关闭连接失败:', error)
    }
  }

  /**
   * 保存或更新实例信息
   * @param instanceInfo 实例信息
   */
  async saveInstance(instanceInfo: InstanceInfo): Promise<void> {
    if (!this.instancesCollection) {
      throw new Error('MongoDB 尚未连接')
    }

    try {
      await this.instancesCollection.updateOne(
        { server_url: instanceInfo.server_url },
        { $set: instanceInfo },
        { upsert: true }
      )
    } catch (error) {
      console.error('保存实例信息失败:', error)
      throw error
    }
  }

  /**
   * 获取所有实例
   * @returns 实例信息数组
   */
  async getAllInstances(): Promise<InstanceInfo[]> {
    if (!this.instancesCollection) {
      throw new Error('MongoDB 尚未连接')
    }

    try {
      return await this.instancesCollection.find().toArray()
    } catch (error) {
      console.error('获取所有实例失败:', error)
      throw error
    }
  }

  /**
   * 删除指定实例
   * @param serverUrl 服务器URL
   * @returns 是否删除成功
   */
  async removeInstance(serverUrl: string): Promise<boolean> {
    if (!this.instancesCollection) {
      throw new Error('MongoDB 尚未连接')
    }

    try {
      const result = await this.instancesCollection.deleteOne({
        server_url: serverUrl
      })
      return result.deletedCount > 0
    } catch (error) {
      console.error('删除实例失败:', error)
      throw error
    }
  }

  /**
   * 获取指定实例
   * @param serverUrl 服务器URL
   * @returns 实例信息
   */
  async getInstance(serverUrl: string): Promise<InstanceInfo | null> {
    if (!this.instancesCollection) {
      throw new Error('MongoDB 尚未连接')
    }

    try {
      return await this.instancesCollection.findOne({ server_url: serverUrl })
    } catch (error) {
      console.error('获取实例失败:', error)
      throw error
    }
  }
}
