import { MongoDB } from '../db/mongodb'
import { Ech0Service } from './ech0Service'
import { InstanceInfo } from '../types'

/**
 * 健康检查服务，定期检查实例活跃状态
 */
export class HealthCheckService {
  private db: MongoDB
  private ech0Service: Ech0Service
  private intervalId: ReturnType<typeof setInterval> | null = null
  private checkIntervalMs: number
  private maxFailures: number
  private relayServerUrl: string

  /**
   * 创建健康检查服务
   * @param db MongoDB实例
   * @param ech0Service Ech0服务实例
   * @param checkIntervalSeconds 检查间隔（秒），默认5分钟（300秒）
   * @param maxFailures 最大允许失败次数，默认2次
   * @param relayServerUrl Relay服务器URL，排除自身检查
   */
  constructor(
    db: MongoDB,
    ech0Service: Ech0Service,
    checkIntervalSeconds: number = 5 * 60,
    maxFailures: number = 2,
    relayServerUrl: string
  ) {
    this.db = db
    this.ech0Service = ech0Service
    this.checkIntervalMs = checkIntervalSeconds * 1000 // 将秒转换为毫秒
    this.maxFailures = maxFailures
    this.relayServerUrl = relayServerUrl
  }

  /**
   * 启动健康检查服务
   */
  start(): void {
    if (this.intervalId) {
      this.stop()
    }

    console.log(
      `健康检查服务已启动，检查间隔: ${this.checkIntervalMs / 1000} 秒`
    )
    this.intervalId = setInterval(
      () => this.checkAllInstances(),
      this.checkIntervalMs
    )

    // 立即执行一次检查
    this.checkAllInstances()
  }

  /**
   * 停止健康检查服务
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      console.log('健康检查服务已停止')
    }
  }

  /**
   * 检查所有实例健康状态
   */
  private async checkAllInstances(): Promise<void> {
    try {
      console.log('开始检查所有实例健康状态...')

      // 获取所有实例
      const instances = await this.db.getAllInstances()
      const checkedCount = instances.length
      let activeCount = 0
      let failedCount = 0
      let removedCount = 0

      for (const instance of instances) {
        // 跳过自身实例检查
        if (instance.server_url === this.relayServerUrl) {
          activeCount++
          continue
        }

        try {
          // 尝试获取实例连接信息
          await this.ech0Service.fetchConnectInfo(instance.server_url)

          // 成功获取，重置失败计数
          if (instance.failure_count && instance.failure_count > 0) {
            await this.resetFailureCount(instance)
          }

          activeCount++
        } catch {
          // 检查失败，增加失败计数
          await this.incrementFailureCount(instance)

          // 检查是否达到最大失败次数
          if ((instance.failure_count || 0) + 1 >= this.maxFailures) {
            // 达到最大失败次数，从数据库中删除
            await this.db.removeInstance(instance.server_url)
            console.log(
              `实例 ${instance.server_url} 连续 ${this.maxFailures} 次检查失败，已删除`
            )
            removedCount++
          } else {
            failedCount++
          }
        }
      }

      console.log(
        `健康检查完成: 共 ${checkedCount} 个实例，活跃 ${activeCount} 个，失败 ${failedCount} 个，移除 ${removedCount} 个`
      )
    } catch (error) {
      console.error('健康检查过程出错:', error)
    }
  }

  /**
   * 重置实例失败计数
   */
  private async resetFailureCount(instance: InstanceInfo): Promise<void> {
    try {
      instance.failure_count = 0
      instance.last_updated = new Date()
      await this.db.saveInstance(instance)
    } catch (error) {
      console.error(`重置实例 ${instance.server_url} 失败计数出错:`, error)
    }
  }

  /**
   * 增加实例失败计数
   */
  private async incrementFailureCount(instance: InstanceInfo): Promise<void> {
    try {
      instance.failure_count = (instance.failure_count || 0) + 1
      instance.last_updated = new Date()
      await this.db.saveInstance(instance)
      console.log(
        `实例 ${instance.server_url} 检查失败，当前失败次数: ${instance.failure_count}`
      )
    } catch (error) {
      console.error(`增加实例 ${instance.server_url} 失败计数出错:`, error)
    }
  }
}
