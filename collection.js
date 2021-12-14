import https from 'https'

export default function (url) {
  if (!this.item.link) return false;

  var reg = /^([hH][tT]{2}[pP]:\/\/|[hH][tT]{2}[pP][sS]:\/\/)(([A-Za-z0-9-~]+)\.)+([A-Za-z0-9-~\/])+$/;
  if (!reg.test(url)) url = "https://" + url;

  https.get(url, resp => {
    let data = ''
    resp.on('data', chunk => data += chunk)
    resp.on('end', () => {
      console.log(JSON.parse(data).explanation)
    })
  }).on('error', err => {
    console.log(err.message)
  })
  //this.$axios.get(this.item.link).then((res) => {
  //  console.log(res.data);
  //});
}