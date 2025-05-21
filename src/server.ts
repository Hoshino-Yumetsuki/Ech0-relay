import express from 'express'
import cors from 'cors'
import axios from 'axios'
import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'
import { HealthCheckService } from './services/healthCheckService'
import { Ech0Service } from './services/ech0Service'

// 加载环境变量
dotenv.config()

// 类型定义
interface ConnectInfo {
  server_name: string
  server_url: string
  logo: string
  ech0s: number
  sys_username: string
}

interface Ech0Response<T> {
  code: number
  msg: string
  data: T
}

interface InstanceInfo {
  server_url: string
  last_updated: Date
  connect_info: Ech0Response<ConnectInfo>
}

// 默认配置
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017'
const DB_NAME = 'ech0_relay'
const COLLECTION_NAME = 'instances'

// 健康检查配置
// 单位：秒，转换为毫秒
const HEALTH_CHECK_INTERVAL = (process.env.HEALTH_CHECK_INTERVAL
  ? parseInt(process.env.HEALTH_CHECK_INTERVAL, 10)
  : 5 * 60) * 1000 // 默认5分钟 (300秒)

const MAX_FAILURES = process.env.MAX_FAILURES
  ? parseInt(process.env.MAX_FAILURES, 10)
  : 2 // 默认允许2次失败

// Relay自身实例配置
const RELAY_SERVER_NAME = process.env.RELAY_SERVER_NAME || 'Ech0中继服务'
const RELAY_SERVER_URL =
  process.env.RELAY_SERVER_URL || `http://localhost:${PORT}`
const RELAY_LOGO = process.env.RELAY_LOGO || ''
const RELAY_SYS_USERNAME = process.env.RELAY_SYS_USERNAME || 'admin'

// 创建自身relay实例的连接信息
const relayConnectInfo: Ech0Response<ConnectInfo> = {
  code: 1,
  msg: '连接成功',
  data: {
    server_name: RELAY_SERVER_NAME,
    server_url: RELAY_SERVER_URL,
    logo: RELAY_LOGO,
    ech0s: 0, // 初始值为0，后续会更新
    sys_username: RELAY_SYS_USERNAME
  }
}

// 创建Express应用
const app = express()

// 使用中间件
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// MongoDB客户端
let client: MongoClient
let db: any
let instancesCollection: any

// 服务实例
let ech0Service: Ech0Service
let healthCheckService: HealthCheckService

// 连接MongoDB并启动服务器
async function startServer() {
  try {
    // 连接到MongoDB
    client = new MongoClient(MONGODB_URI)
    await client.connect()
    console.log('MongoDB 连接成功')

    // 获取数据库和集合
    db = client.db(DB_NAME)
    instancesCollection = db.collection(COLLECTION_NAME)

    // 创建索引确保server_url的唯一性
    await instancesCollection.createIndex({ server_url: 1 }, { unique: true })

    // 初始化Ech0服务
    const mongodbWrapper = {
      saveInstance: async (instanceInfo: any) => {
        await instancesCollection.updateOne(
          { server_url: instanceInfo.server_url },
          { $set: instanceInfo },
          { upsert: true }
        )
      },
      getAllInstances: async () => {
        return await instancesCollection.find().toArray()
      },
      getInstance: async (serverUrl: string) => {
        return await instancesCollection.findOne({ server_url: serverUrl })
      },
      removeInstance: async (serverUrl: string) => {
        const result = await instancesCollection.deleteOne({
          server_url: serverUrl
        })
        return result.deletedCount > 0
      }
    }

    // 创建Ech0服务实例
    ech0Service = new Ech0Service(mongodbWrapper as any)

    // 将relay自身信息保存到数据库
    try {
      // 准备relay实例信息
      const relayInstanceInfo: InstanceInfo = {
        server_url: RELAY_SERVER_URL,
        last_updated: new Date(),
        connect_info: relayConnectInfo
      }

      // 保存或更新relay实例信息
      await instancesCollection.updateOne(
        { server_url: RELAY_SERVER_URL },
        { $set: relayInstanceInfo },
        { upsert: true }
      )

      console.log('已将relay实例信息保存到数据库')
    } catch (err) {
      console.error('保存relay实例信息失败:', err)
      // 继续启动服务，不因此失败
    }

    // 初始化健康检查服务
    healthCheckService = new HealthCheckService(
      mongodbWrapper as any,
      ech0Service,
      HEALTH_CHECK_INTERVAL,
      MAX_FAILURES,
      RELAY_SERVER_URL
    )

    // 启动Express服务器
    app.listen(PORT, () => {
      console.log(`Ech0中继服务器已启动，监听端口 ${PORT}`)
      console.log(`
当前relay实例信息:
- 名称: ${RELAY_SERVER_NAME}
- URL: ${RELAY_SERVER_URL}
- 用户名: ${RELAY_SYS_USERNAME}

可用接口:
- /api/connect - 获取所有Ech0实例信息（自动注册实例）
      `)

      // 启动健康检查服务
      healthCheckService.start()
      console.log(
        `健康检查服务已启动，检查间隔: ${HEALTH_CHECK_INTERVAL / 1000} 秒，最大失败次数: ${MAX_FAILURES}`
      )
    })
  } catch (error) {
    console.error('服务器启动失败:', error)
    process.exit(1)
  }
}

// 规范化URL
function normalizeUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url
}

// 获取Ech0实例的连接信息
async function fetchConnectInfo(
  url: string
): Promise<Ech0Response<ConnectInfo>> {
  try {
    const normalizedUrl = normalizeUrl(url)
    const connectUrl = `${normalizedUrl}/api/connect`

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

// 保存实例信息到数据库
async function saveInstance(
  serverUrl: string,
  connectInfo: Ech0Response<ConnectInfo>
): Promise<void> {
  const normalizedUrl = normalizeUrl(serverUrl)

  const instanceInfo: InstanceInfo = {
    server_url: normalizedUrl,
    last_updated: new Date(),
    connect_info: connectInfo
  }

  await instancesCollection.updateOne(
    { server_url: normalizedUrl },
    { $set: instanceInfo },
    { upsert: true }
  )
}

// 从数据库获取所有实例
async function getAllInstances(): Promise<Ech0Response<ConnectInfo>[]> {
  // 获取当前实例数量作为ech0s值
  const instCount = await instancesCollection.countDocuments()

  // 更新relay实例的ech0s计数
  relayConnectInfo.data.ech0s = instCount

  // 从数据库获取所有实例
  const instances = await instancesCollection.find().toArray()

  // 将所有实例转换为响应格式
  const instanceResponses = instances.map(
    (instance: InstanceInfo) => instance.connect_info
  )

  // 确保数组中包含relay自身信息
  // 检查relay实例是否已存在
  const relayExists = instanceResponses.some((resp) => {
    return resp.data.server_url === RELAY_SERVER_URL
  })

  // 如果不存在，则添加relay自身信息
  if (!relayExists) {
    instanceResponses.push(relayConnectInfo)
  }

  return instanceResponses
}

// 路由定义

// Ech0 Connect端点 - 获取所有连接的Ech0实例信息
app.get('/api/connect', async (req, res) => {
  try {
    // 从请求头获取Ech0_url
    const ech0Url = req.header('Ech0_url')

    // 如果请求头中有Ech0_url，则将该实例信息保存到数据库
    if (ech0Url) {
      try {
        // 请求该实例的Connect信息
        const connectInfo = await fetchConnectInfo(ech0Url)

        // 保存实例信息到数据库
        await saveInstance(ech0Url, connectInfo)

        console.log(`已记录来自 ${ech0Url} 的实例信息`)
      } catch (error) {
        console.error(`处理来自 ${ech0Url} 的请求时出错:`, error)
        // 即使记录失败，我们仍然会返回所有实例信息
      }
    }

    // 获取所有实例信息并返回
    const allInstances = await getAllInstances()
    res.json(allInstances)
  } catch (error) {
    console.error('处理 /api/connect 请求时出错:', error)
    res.status(500).json({
      code: 0,
      msg: '服务器内部错误',
      data: null
    })
  }
})

// 优雅退出处理
process.on('SIGINT', async () => {
  console.log('正在关闭服务...')
  if (client) {
    await client.close()
    console.log('MongoDB连接已关闭')
  }
  process.exit(0)
})

// 启动服务器
startServer().catch((error) => {
  console.error('未捕获的错误:', error)
  process.exit(1)
})
