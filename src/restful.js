// 标准
// 所有访问路径皆为对象
// 所有对象都有共同的属性和方法
// 使用权限管理

// 因此, 一个 RESTful API 的模型
// 由无限对象组成
// 由无限权限组成
// 由无限方法组成

// 对象
export class object {
  // 对象可以删除, 修改, 添加子项
  // 对象可以赋权, 取消赋权, 引用赋权

  constructor(id) {
    // 通过 ID 载入对象(虚拟)
    // 仅在确实读取到数据时, 才会从数据库中读入数据
  }

  PUT(data) {
    // data, 应具有对象模型的基本属性
    // ID, 名称, 描述, 父级, 权限, 子项
  }

  PATCH(data) {}

  DELETE() {
    // 删除对象(自身而不是子项)
    // 从数据库删除对象
    // 从内存中删除对象
    // 因此, 对象是虚拟的, 并没有数据
  }

}

// 权限
export class permission {
}

// 方法
export class method {
}


// 数据并不需要固定的模型
// 因为只要及时更改迁移或虚拟引用(集,交集,并集,差集)


// (因为后端程序的用意, 便是灵活管理数据)
// 权限也只是一个数据集(虚拟)



// 无限虚拟集中取常用集及查询方式(针对反复查询的纬度建立索引)



// 1. 无限新建对象
// 2. 无限新建集合(集合模型)(虚拟对象)
// 3. 对象归类于集合
// 4. 权限是集合之一

// 单体数据也属于集合(非重复)
// 单体数据只有摘要
// 没有关联数据不需要关系型数据库

// 使用 levelDB 作为数据库, 无需配置依赖
// 无限创建库

import level from 'level'

export class mono {
  constructor() {
    // 无需初始化基础库, ROOT无需注册
    // 载入热数据
  }

  检查并创建目录(dirname) {
    if (fs.existsSync(dirname)) {
      return true
    } else if (thiss.检查并创建目录(path.dirname(dirname))) {
      fs.mkdirSync(dirname)
      return true
    }
    return false
  }
}
