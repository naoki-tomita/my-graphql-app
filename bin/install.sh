get_os() {
  uname | tr '[:upper:]' '[:lower:]'
}

get_cpu() {
  if [[ "$(uname -p)" = "i686" ]]; then
    echo "x86"
  else
    echo "x64"
  fi
}

install_nodejs() {
  local code
  url=https://nodejs.org/dist/v12.16.0/node-v12.16.0-"$(get_os)"-"$(get_cpu)".tar.xz
  code=$(curl "$url" -L --silent --fail --retry 5 --retry-max-time 15 -o /tmp/node.tar.xz --write-out "%{http_code}")
  tar Jxf /tmp/node.tar.xz -C /tmp

  mkdir -p "$BUILD_DIR"/.heroku/node
  rm -rf "$BUILD_DIR"/.heroku/node/*
  mv /tmp/node-v12.16.0-"$(get_os)"-"$(get_cpu)"/* "$BUILD_DIR"/.heroku/node
  chmod +x "$BUILD_DIR"/.heroku/node/bin/*
  export PATH="$BUILD_DIR/.heroku/node/bin":$PATH
}
