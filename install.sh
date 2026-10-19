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
zip -qr "$ZIP_NAME" . -x "po/*"

if [ "$BUNDLE" -eq 1 ]; then
    mv "$ZIP_NAME" ..
else
    echo ":: Installing extension..."
    DEST="$HOME/.local/share/gnome-shell/extensions/$NAME@$DOMAIN"

    # gnome-extensions install 失败时会先删除旧目录再复制，导致扩展丢失，
    # 因此失败时兜底为直接解包（需注销重登或 killall -HUP gnome-shell 生效）
    if gnome-extensions install -f "$ZIP_NAME"; then
        rm "$ZIP_NAME"
    else
        echo ":: gnome-extensions install failed, falling back to unzip..."
        rm -rf "$DEST"
        mkdir -p "$DEST"
        unzip -oq "$ZIP_NAME" -d "$DEST"
        rm "$ZIP_NAME"
        echo ":: Installed to $DEST"
    fi
fi