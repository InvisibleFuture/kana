git pull

chmod 777 start.sh

pm2 delete shizukana
pm2 start yarn --name shizukana -- index