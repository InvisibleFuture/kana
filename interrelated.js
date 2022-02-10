export default class interrelated {
  constructor() {
    this.A的集合 = new Map()
    this.B的集合 = new Map()
  }

  关联数据(A, B) {
    let value = this.A的集合.get(A) || new Map()
    if (!value.size) this.A的集合.set(A, value)
    value.set(B, true)

    let valux = this.B的集合.get(B) || new Map()
    if (!valux.size) this.B的集合.set(B, valux)
    valux.set(A, true)
  }

  取消关联(A, B) {
    let value = this.A的集合.get(A)
    if (value && value.size) value.delete(B)
    if (value && value.size === 0) this.A的集合.delete(A)

    let valux = this.B的集合.get(B)
    if (valux && valux.size) valux.delete(A)
    if (valux && valux.size === 0) this.B的集合.delete(B)
  }

  A中取B(A, callback) {
    let value = this.A的集合.get(A)
    if (value && value.size) {
      value.forEach((value, B) => callback(B))
    }
  }

  B中取A(B, callback) {
    let valux = this.B的集合.get(B)
    if (valux && valux.size) {
      valux.forEach((value, A) => callback(A))
    }
  }

  A中除B(B) {
    let value = this.B的集合.get(B)
    if (value && value.size) value.forEach((value, A) => {
      let valux = this.A的集合.get(A)
      if (valux && valux.size) valux.delete(B)
    })
    this.B的集合.delete(B)
  }

  B中除A(A) {
    let value = this.A的集合.get(A)
    if (value && value.size) value.forEach((value, B) => {
      let valux = this.B的集合.get(B)
      if (valux && valux.size) valux.delete(A)
    })
    this.A的集合.delete(A)
  }

  // 读取所有 a
  // aall(uid, callback) {
  //   this.channels.forEach((value, key) => {
  //     callback(key)
  //   })
  // }
  //
  // 读取所有 b
  // ball(fid, callback) {
  //   this.users.forEach((value, key) => {
  //     callback(key)
  //   })
  // }
}
