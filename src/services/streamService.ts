import axios from 'axios'
import { InstanceInfo } from '../types'

/**
 * 上下游服务，负责处理relay之间的数据传递
 */
export class StreamService {
  private upstreamUrls: string[] = []
  private relayServerUrl: string

  /**
   * 创建上下游服务
   * @param relayServerUrl 当前relay服务器的URL
   * @param upstreamConfig 上游配置字符串，逗号分隔的URL列表
   */
  constructor(relayServerUrl: string, upstreamConfig?: string) {
    this.relayServerUrl = relayServerUrl
    this.parseUpstreamConfig(upstreamConfig)
  }

  /**
   * 解析上游配置字符串
   * @param upstreamConfig 上游配置字符串
   */
  private parseUpstreamConfig(upstreamConfig?: string): void {
    if (!upstreamConfig) {
      return
    }

    const urls = upstreamConfig.split(',').map((url) => url.trim())
    // 过滤掉空URL
    this.upstreamUrls = urls.filter((url) => url && url.length > 0)

    if (this.upstreamUrls.length > 0) {
      console.log(`已配置 ${this.upstreamUrls.length} 个上游relay:`)
      this.upstreamUrls.forEach((url) => console.log(`- ${url}`))
    }
  }

  /**
   * 获取所有上游relay的实例信息
   * @returns 所有上游实例的信息数组
   */
  async getUpstreamInstances(): Promise<InstanceInfo[]> {
    if (this.upstreamUrls.length === 0) {
      return []
    }

    const allInstances: InstanceInfo[] = []
    const processingErrors: string[] = []

    await Promise.all(
      this.upstreamUrls.map(async (upstreamUrl) => {
        try {
          console.log(`正在从上游relay获取实例信息: ${upstreamUrl}`)
          const response = await axios.get(`${upstreamUrl}/api/connect`, {
            headers: {
              Ech0_url: this.relayServerUrl // 发送自身URL以便上游relay注册
            }
          })

          // 获取响应数据
          const data = response.data

          // 验证数据是否为数组
          if (Array.isArray(data)) {
            // 处理数组响应格式
            const instances = this.processArrayResponse(data, upstreamUrl)
            allInstances.push(...instances)
          } else if (data && typeof data === 'object') {
            // 尝试处理单个对象响应格式
            const instance = this.processObjectResponse(data, upstreamUrl)
            if (instance) {
              allInstances.push(instance)
            }
          } else {
            throw new Error(`意外的响应格式: ${typeof data}`)
          }
        } catch (error: any) {
          const errorMessage = `从上游relay获取实例信息失败 ${upstreamUrl}: ${error?.message || String(error)}`
          console.error(errorMessage)
          processingErrors.push(errorMessage)
        }
      })
    )

    if (processingErrors.length > 0) {
      console.warn(
        `从上游relay获取实例信息时发生了 ${processingErrors.length} 个错误`
      )
    }

    return this.deduplicateInstances(allInstances)
  }

  /**
   * 处理数组格式的响应
   * @param data 数组响应数据
   * @param upstreamUrl 上游URL
   * @returns 处理后的实例信息数组
   */
  private processArrayResponse(
    data: any[],
    upstreamUrl: string
  ): InstanceInfo[] {
    const instances: InstanceInfo[] = []

    data.forEach((item, index) => {
      if (this.isValidInstanceResponse(item)) {
        // 确保服务器URL是绝对URL
        const serverUrl = item.data.server_url
        if (serverUrl && serverUrl !== this.relayServerUrl) {
          instances.push({
            server_url: serverUrl,
            last_updated: new Date(),
            connect_info: item
          })
        }
      } else {
        console.warn(
          `上游relay返回了无效的实例数据 ${upstreamUrl}, 索引 ${index}`
        )
      }
    })

    console.log(
      `从上游relay获取了 ${instances.length} 个实例信息: ${upstreamUrl}`
    )
    return instances
  }

  /**
   * 处理对象格式的响应
   * @param data 对象响应数据
   * @param upstreamUrl 上游URL
   * @returns 处理后的实例信息，如果无效则返回null
   */
  private processObjectResponse(
    data: any,
    upstreamUrl: string
  ): InstanceInfo | null {
    if (this.isValidInstanceResponse(data)) {
      // 确保服务器URL是绝对URL
      const serverUrl = data.data.server_url
      if (serverUrl && serverUrl !== this.relayServerUrl) {
        return {
          server_url: serverUrl,
          last_updated: new Date(),
          connect_info: data
        }
      }
    } else {
      console.warn(`上游relay返回了无效的实例数据 ${upstreamUrl}`)
    }

    return null
  }

  /**
   * 验证实例响应是否有效
   * @param item 实例响应项
   * @returns 是否为有效实例响应
   */
  private isValidInstanceResponse(item: any): boolean {
    return (
      item &&
      typeof item === 'object' &&
      typeof item.code === 'number' &&
      typeof item.msg === 'string' &&
      item.data &&
      typeof item.data === 'object' &&
      typeof item.data.server_url === 'string' &&
      typeof item.data.server_name === 'string'
    )
  }

  /**
   * 去除重复的实例
   * @param instances 实例数组
   * @returns 去重后的实例数组
   */
  private deduplicateInstances(instances: InstanceInfo[]): InstanceInfo[] {
    const uniqueInstances = new Map<string, InstanceInfo>()

    // 用server_url作为唯一标识
    instances.forEach((instance) => {
      uniqueInstances.set(instance.server_url, instance)
    })

    return Array.from(uniqueInstances.values())
  }
}
