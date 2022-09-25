// 实现一个简单的缓存，默认10分钟自动过期
export default class Cache {
  constructor(date=10) {
    this.date = date * 60 * 1000;
    this.cache = new Map();
  }
  set(key, value) {
    this.cache.set(key, { value, expire: Date.now() + this.date });
  }
  get(key) {
    let item = this.cache.get(key);
    if (!item) {
      return null;
    }
    if (item.expire < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }
}
