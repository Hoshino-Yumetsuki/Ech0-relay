# Ech0-Relay 转发模块

## 项目介绍

Ech0-Relay是一个专门为Ech0系统设计的转发模块，可以模拟Ech0服务端，获取连接实例的公开数据，并允许被其他系统拉取数据。该模块基于TypeScript开发，使用Express作为Web服务器框架。

## 功能特性

- **数据聚合**：从多个Ech0实例获取数据并聚合
- **缓存机制**：内置缓存系统，减少对远程Ech0实例的请求频率
- **标准API**：提供与Ech0服务端兼容的API接口
- **管理接口**：提供实例管理接口，便于添加、删除和同步Ech0实例
- **错误处理**：完善的错误处理和日志输出

## 安装与使用

### 系统要求

- Node.js 16+
- Yarn 4+

### 安装依赖

```bash
yarn install
```

### 启动服务

```bash
yarn start
```

默认情况下，服务将在3000端口启动。你可以通过设置环境变量`PORT`来修改端口号。

### 开发模式

```bash
yarn dev
```

## API接口说明

### Ech0兼容API

这些接口与Ech0原生API保持兼容，可以被其他Ech0实例或客户端调用。

- `GET /api/status` - 获取状态信息
- `GET /api/heatmap` - 获取热力图数据
- `GET /api/allusers` - 获取所有用户
- `GET /api/connect` - 获取Connect信息
- `GET /api/connects` - 获取Connect列表

### 管理API

这些接口用于管理Ech0-Relay转发模块。

- `POST /relay/add` - 添加Ech0实例
  - 参数: `{url: "https://example.com"}`
- `POST /relay/remove` - 移除Ech0实例
  - 参数: `{url: "https://example.com"}`
- `POST /relay/sync` - 同步远程连接
  - 参数: `{url: "https://example.com"}`
- `GET /relay/instances` - 获取实例列表

## 使用示例

### 添加Ech0实例

```bash
curl -X POST http://localhost:3000/relay/add \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example-ech0.com"}'
```

### 获取用户列表

```bash
curl http://localhost:3000/api/allusers
```

## 架构说明

### 核心组件

- **Ech0RelayServer**：主服务器类，负责启动服务并处理HTTP请求
- **Ech0Manager**：管理多个Ech0实例的连接
- **Ech0Client**：与远程Ech0实例交互的客户端
- **Cache**：内存缓存，减少对远程服务的请求

### 数据流程

1. 客户端请求Ech0-Relay的API
2. Ech0-Relay检查缓存是否有相应数据
3. 如果缓存中没有数据，则从已连接的Ech0实例获取数据
4. 数据获取后进行处理（如聚合、过滤等）
5. 将处理后的数据返回给客户端，并更新缓存

## 许可证

MIT