/**
 * Gravatar 头像缓存插件
 */

import md5 from 'md5'
import path from 'path'
import request from 'request'
import { createWriteStream, existsSync, mkdirSync } from 'fs'

const 镜像站列表 = [
  'gravatar.loli.net',    // loli.net
  'sdn.geekzu.org',       // 极客族公共加速服务
  'cravatar.cn',          // Cravatar - 中国的公共头像服务
  'gravatar.inwao.com',   // 「公益」Gravatar 韩国免费高速镜像源｜支持负载均衡 - inwao blog
  'gravatar.loli.top',    // 自建Gravatar国内+全球镜像加速服务 | 城南旧事 (loli.top)
  'gravatar.zeruns.tech', // Gravatar头像介绍 镜像地址大全 - Zeruns's Blog
  'secure.gravatar.com',  // Gravatar 官网
]

var 头像来源 = 0

function getGravatar(email, size) {
  let str = email ? md5(email.toLowerCase()) : 'default'
  let 本地路径 = './data/avatar/' + str + '.jpg'
  let 网络路径 = `https://${镜像站列表[头像来源]}/avatar/${str}.jpg?s=${size}&d=mm&r=g`
  if (!existsSync(本地路径)) {
    request(网络路径).on('error', function (err) {
      头像来源++
      if (镜像站列表.length <= 头像来源) {
        return console.log("下载头像失败, 使用默认头像")
      }
      getGravatar(email, size)
    }).pipe(createWriteStream(本地路径))
  }
}


function 检查并创建目录(dirname) {
  if (existsSync(dirname)) {
    return true
  } else if (检查并创建目录(path.dirname(dirname))) {
    mkdirSync(dirname)
    return true
  }
  return fasle
}

export default {
  // 激活插件方法
  activate() {
    检查并创建目录('./data/avatar/')
  },

  // 禁用插件方法
  deactivate() {
    // 停用插件并删除目录
  },

  // 向头像获取方法插入替换
  getGravatar, // 获取头像(如果不存在自动从网络下载)
}
