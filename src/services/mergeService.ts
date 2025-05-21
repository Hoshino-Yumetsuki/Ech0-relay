import { InstanceInfo, Ech0Response, ConnectInfo } from '../types'

/**
 * 合并本地实例和上游实例，去除重复
 * @param localInstances 本地实例列表
 * @param upstreamInstances 上游实例列表
 * @returns 合并后的实例响应列表
 */
export function mergeInstances(
  localInstances: Ech0Response<ConnectInfo>[],
  upstreamInstances: InstanceInfo[]
): Ech0Response<ConnectInfo>[] {
  // 转换上游实例到标准响应格式
  const upstreamResponses = upstreamInstances.map(
    (instance) => instance.connect_info
  )

  // 初始合并所有实例
  const allResponses = [...localInstances, ...upstreamResponses]

  // 使用Map去除重复，以server_url为唯一标识
  const uniqueResponses = new Map<string, Ech0Response<ConnectInfo>>()

  for (const response of allResponses) {
    const serverUrl = response.data.server_url
    // 仅当没有该URL或者本地实例优先时才添加
    if (!uniqueResponses.has(serverUrl) || localInstances.includes(response)) {
      uniqueResponses.set(serverUrl, response)
    }
  }

  return Array.from(uniqueResponses.values())
}
