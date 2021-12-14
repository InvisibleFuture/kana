export default {
  用户信息隐私保护(user) {
    delete user.password
    delete user.salt
    delete user.mobile
    delete user.email
    return user
  },
  用户信息密码保护(user) {
    delete user.password
    delete user.salt
    return user
  }
}