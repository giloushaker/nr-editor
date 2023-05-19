appdir="."
user="vflam"
server="vflam@newrecruit.eu"
target="/home/$user/nr-editor"

ssh $server "rm $target/.nuxt/dist/client/*"
rsync -pogtrzvL $appdir/.nuxt $server:$target
rsync -pogtrzvL $appdir/.output $server:$target
rsync -pogtrzvL $appdir/assets $server:$target
rsync -pogtrzvL $appdir/types $server:$target
rsync -pogtrzvL $appdir/components $server:$target
rsync -pogtrzvL $appdir/pages $server:$target
rsync -pogtrzvL $appdir/plugins $server:$target
rsync -pogtrzvL $appdir/server $server:$target
rsync -pogtrzvL $appdir/public $server:$target

# rsync -rpogtzv  --include='*.js' --exclude='*' $appdir/ $server:$target
rsync -rpogtzv  --include='*.json' --exclude='*' $appdir/ $server:$target