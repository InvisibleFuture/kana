const FileListTemp = new Map()

export default {
  // 上传图像时
  upload(req, res) {
    formidable({
      multiples: true,
      uploadDir: 'data/file',
      keepExtensions: true,
      maxFieldsSize: 200 * 1024 * 1024
    }).parse(req, (err, fields, files) => {
      let data = {}

      // 先处理图像的
      let image = files['image']
      if (image) {
        data.image = [];
        (Array.isArray(image) ? image : [image]).forEach(item => {
          file_temp_list.set(item.newFilename, item) // 每帧图像记录到临时表
          data.image.push(item)
        })
      }

      // 其它类型的文件另行处理
      let file = files['file']
      if (file) {
        data.file = [];
        (Array.isArray(file) ? file : [file]).forEach(item => {
          file_temp_list.set(item.newFilename, item)
          data.file.push(item)
        })
      }

      // 返回总记录
      res.json(data)
    })
  },

  // 引用图像时
  // 返回文件记录, 并从 map 中移除
  // 将文件记录到对象的引用列表
  quote(filename) {
    let file = FileListTemp.get(filename)
    if (file) FileListTemp.delete(filename)
    return file
  }

  // 然后只需要定期清理未被引用的过期记录
}


// 终端的对象操作全部ID化, 因而不必有任何其它牵涉
// 如在设置头像时, 直接指定 account/avatar = image/id
// 剩余事务均由后端处理
// patch: /api/account/avatar
// {  }
// 获取本账户上传的所有头像
// 删除本账户上传的指定头像
// 设置头像为指定头像