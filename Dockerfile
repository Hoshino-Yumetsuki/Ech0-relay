FROM node:20-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package.json ./

RUN corepack enable

# 安装依赖
RUN yarn install

# 复制源代码
COPY . .

# 构建应用
RUN yarn build

# 第二阶段：运行环境
FROM node:lts-alpine

WORKDIR /app

# 创建非root用户
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# 设置时区为上海
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone

# 复制构建产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY .env.example ./.env

# 安装生产依赖
RUN yarn install --production

# 切换到非root用户
USER appuser

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=60s --timeout=5s --start-period=5s --retries=3 CMD wget -qO- http://localhost:3000/api/connect || exit 1

# 设置环境变量
ENV NODE_ENV=production

# 启动应用
CMD ["node", "dist/index.js"]
