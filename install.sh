#!/usr/bin/env bash

BUNDLE=0

for arg in "$@"; do
    [ "$arg" = "--bundle" ] && BUNDLE=1
done

NAME="ez-launcher"
DOMAIN="linux.itez.cc"
ZIP_NAME="$NAME@$DOMAIN.zip"

echo ":: Compiling translations..."
cd src

for po in po/*.po; do
    lang="$(basename "${po%.po}")"

    mkdir -p "locale/$lang/LC_MESSAGES"
    msgfmt -o "locale/$lang/LC_MESSAGES/$NAME@$DOMAIN.mo" "$po"
done

echo ":: Creating extension bundle..."
zip -qr "$ZIP_NAME" . -x "po/*" "schemas/gschemas.compiled"

if [ "$BUNDLE" -eq 1 ]; then
    mv "$ZIP_NAME" ..
else
    echo ":: Installing extension..."
    DEST="$HOME/.local/share/gnome-shell/extensions/$NAME@$DOMAIN"

    # 安装交由系统扩展安装器完成：安装时它会自动对 schemas/ 执行 glib-compile-schemas，
    # 因此打包无需携带 schemas/gschemas.compiled（需注销重登或 killall -HUP gnome-shell 生效）
    if ! gnome-extensions install -f "$ZIP_NAME"; then
        # 兜底：该命令偶发因 GIO 递归复制失败而中断，且失败前可能已删除旧目录。
        # 手动解包不会编译 schema，故必须补跑 glib-compile-schemas，否则扩展加载时会报
        # "Schema ... could not be found" 而直接失效。
        echo ":: gnome-extensions install failed, falling back to manual unzip..."
        rm -rf "$DEST"
        mkdir -p "$DEST"
        unzip -oq "$ZIP_NAME" -d "$DEST"
        glib-compile-schemas "$DEST/schemas"
        echo ":: Installed to $DEST"
    fi

    rm "$ZIP_NAME"
fi