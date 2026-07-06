#!/bin/sh
# Release-Skript für Blitz & Donner PDF (Slug blitz-donner-pdf, Präfix bdpdf).
#
# Baut das Release-ZIP aus dem Repo, signiert es mit dem Ed25519-
# Produktivschlüssel und publiziert es über den REST-Publish-Endpunkt
# des Update-Servers (Deploy-Token, Bearer).
#
# Voraussetzungen (alles lokal, nichts davon liegt im Repo):
#   ~/.bd-deploy-tokens/bdpdf.token          Deploy-Token (chmod 600)
#   ~/.bd-signing-keys/bd-produktiv-2026.key privater Signierschlüssel
#   ../bd-plugin-updater/tools/bd-sign.php   Signier-CLI
#
# Aufruf:  tools/release.sh "Changelog-Text für diese Version"

set -eu

REPO_DIR=$(cd "$(dirname "$0")/.." && pwd)
SIGN_TOOL="$REPO_DIR/../bd-plugin-updater/tools/bd-sign.php"
KEY_FILE="$HOME/.bd-signing-keys/bd-produktiv-2026.key"
TOKEN_FILE="$HOME/.bd-deploy-tokens/bdpdf.token"
SERVER="https://plugins.blitzdonner.ch"
SLUG="blitz-donner-pdf"

CHANGELOG=${1:?Aufruf: tools/release.sh "Changelog-Text"}

for f in "$SIGN_TOOL" "$KEY_FILE" "$TOKEN_FILE"; do
	[ -r "$f" ] || { echo "FEHLER: $f fehlt oder ist nicht lesbar." >&2; exit 1; }
done

VERSION=$(sed -n 's/^ \* Version:[[:space:]]*//p' "$REPO_DIR/blitz-donner-pdf.php" | head -1)
[ -n "$VERSION" ] || { echo "FEHLER: Version nicht aus blitz-donner-pdf.php lesbar." >&2; exit 1; }

BUILD_DIR=$(mktemp -d)
trap 'rm -rf "$BUILD_DIR"' EXIT

echo "— Baue blitz-donner-pdf-$VERSION.zip"
rsync -a --exclude='.git' --exclude='.github' --exclude='graphify-out' \
	--exclude='.DS_Store' --exclude='tools' "$REPO_DIR/" "$BUILD_DIR/blitz-donner-pdf/"
( cd "$BUILD_DIR" && zip -qr "blitz-donner-pdf-$VERSION.zip" blitz-donner-pdf )
ZIP="$BUILD_DIR/blitz-donner-pdf-$VERSION.zip"
shasum -a 256 "$ZIP"

echo "— Signiere"
SIGN_OUT=$(php "$SIGN_TOOL" sign "$KEY_FILE" "$ZIP")
SIGNATURE=$(printf '%s\n' "$SIGN_OUT" | sed -n 's/^signature[[:space:]]*: //p')
KEY_ID=$(printf '%s\n' "$SIGN_OUT" | sed -n 's/^key_id[[:space:]]*: //p')
[ -n "$SIGNATURE" ] && [ -n "$KEY_ID" ] || { echo "FEHLER: Signieren fehlgeschlagen." >&2; exit 1; }

echo "— Publiziere $VERSION auf $SERVER"
HTTP=$(curl -sS -o "$BUILD_DIR/antwort.json" -w '%{http_code}' \
	-X POST "$SERVER/wp-json/bd-updater/publish/$SLUG" \
	-H "Authorization: Bearer $(cat "$TOKEN_FILE")" \
	-F "zip=@$ZIP;type=application/zip" \
	-F "version=$VERSION" \
	-F "changelog=$CHANGELOG" \
	-F "signature=$SIGNATURE" \
	-F "key_id=$KEY_ID")
echo "HTTP $HTTP"
cat "$BUILD_DIR/antwort.json"; echo
[ "$HTTP" = "201" ] || [ "$HTTP" = "200" ] || { echo "FEHLER: Publish fehlgeschlagen." >&2; exit 1; }
echo "— Fertig: $SLUG $VERSION publiziert."
