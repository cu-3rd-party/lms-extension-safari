#!/bin/bash

# Скрипт для автоматической сборки Safari Web Extension только для macOS
# Папка с расширением находится в ../src, проект создается в родительской директории

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Функция для вывода ошибок
error_exit() {
    echo -e "${RED}Ошибка на шаге: $1${NC}" >&2
    exit 1
}

# Функция для информационных сообщений
info() {
    echo -e "${YELLOW}$1${NC}"
}

# Функция для успешных сообщений
success() {
    echo -e "${GREEN}$1${NC}"
}

# 1. Проверка и установка Xcode
info "Проверка установки Xcode..."

# Проверяем установлен ли Xcode Command Line Tools
if xcode-select -p &>/dev/null; then
    success "Xcode Command Line Tools уже установлены"
else
    info "Установка Xcode Command Line Tools..."
    # Запускаем установку
    xcode-select --install
    
    # Ждем завершения установки
    info "Ожидание завершения установки Xcode Command Line Tools..."
    while ! xcode-select -p &>/dev/null; do
        sleep 10
    done
    success "Xcode Command Line Tools успешно установлены"
fi

# Проверяем наличие полной версии Xcode (если нужна)
if [ -d "/Applications/Xcode.app" ]; then
    success "Xcode.app найден"
else
    info "Xcode.app не найден. Убедитесь, что он установлен из App Store для полной функциональности"
fi

# 2. Поиск папки с расширением в ../src
info "Поиск папки с расширением..."

# Получаем текущую директорию (где лежит скрипт)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXTENSION_DIR="$(cd "$SCRIPT_DIR/../src" && pwd)"
PARENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

info "Директория скрипта: $SCRIPT_DIR"
info "Директория расширения: $EXTENSION_DIR"
info "Родительская директория: $PARENT_DIR"

# Проверяем существование директории с расширением
if [ ! -d "$EXTENSION_DIR" ]; then
    error_exit "Папка с расширением не найдена: $EXTENSION_DIR"
fi

# Проверяем наличие manifest.json (базовый признак Web Extension)
if [ ! -f "$EXTENSION_DIR/manifest.json" ]; then
    error_exit "manifest.json не найден в папке расширения: $EXTENSION_DIR"
fi

success "Папка с расширением найдена: $EXTENSION_DIR"

# 3. Использование safari-web-extension-converter с --macos-only
info "Поиск safari-web-extension-converter..."

# Определяем путь к конвертеру
CONVERTER_PATH=$(xcrun --find safari-web-extension-converter 2>/dev/null)

if [ -z "$CONVERTER_PATH" ]; then
    # Пробуем найти через find
    CONVERTER_PATH=$(find /Applications/Xcode.app -name "safari-web-extension-converter" -type f 2>/dev/null | head -1)
fi

if [ -z "$CONVERTER_PATH" ]; then
    error_exit "safari-web-extension-converter не найден. Убедитесь, что установлен Xcode 12 или выше"
else
    success "Конвертер найден: $CONVERTER_PATH"
fi

# Создаем папку для выходного проекта в родительской директории
OUTPUT_DIR="$PARENT_DIR/SafariExtension"

# Если папка уже существует, удаляем ее для чистоты
if [ -d "$OUTPUT_DIR" ]; then
    info "Удаление существующей папки SafariExtension..."
    rm -rf "$OUTPUT_DIR"
fi

info "Создание Safari проекта в: $OUTPUT_DIR"

# Запускаем конвертер с --macos-only
info "Запуск конвертации Web Extension в Safari проект (только macOS)..."
echo "Конвертируем: $EXTENSION_DIR"
echo "Выходная директория: $OUTPUT_DIR"

"$CONVERTER_PATH" "$EXTENSION_DIR" \
    --project-location "$OUTPUT_DIR" \
    --no-open \
    --bundle-identifier "com.cu-lms-enhancer.safari" \
    --macos-only

if [ $? -eq 0 ]; then
    success "Конвертация завершена успешно"
else
    error_exit "Ошибка конвертации"
fi

# 4. Сборка проекта только для macOS
info "Поиск .xcodeproj файла..."

XCODE_PROJECT=$(find "$OUTPUT_DIR" -name "*.xcodeproj" | head -1)

if [ -z "$XCODE_PROJECT" ]; then
    error_exit "Xcode project не найден в $OUTPUT_DIR"
fi

info "Найден проект: $XCODE_PROJECT"

# Получаем имя проекта без расширения
PROJECT_NAME=$(basename "$XCODE_PROJECT" .xcodeproj)

# Переходим в папку проекта для работы со схемами
cd "$(dirname "$XCODE_PROJECT")"

# Смотрим доступные схемы
info "Просмотр доступных схем..."
SCHEMES=$(xcodebuild -list -project "$(basename "$XCODE_PROJECT")" 2>/dev/null | awk '/Schemes:/ {getline; while (NF>0 && $0 !~ /^$/) {print $0; getline}}' | grep -v '^$')

if [ -z "$SCHEMES" ]; then
    # Если схем нет, используем имя проекта
    info "Схемы не найдены, используем имя проекта: $PROJECT_NAME"
    SCHEME_TO_USE="$PROJECT_NAME"
else
    # Используем первую доступную схему
    SCHEME_TO_USE=$(echo "$SCHEMES" | head -1 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    info "Доступные схемы:"
    echo "$SCHEMES"
    info "Используем схему: '$SCHEME_TO_USE'"
fi

# Определяем архитектуру для macOS
info "Определение архитектуры macOS..."
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    DESTINATION="platform=macOS,arch=arm64"
else
    DESTINATION="platform=macOS,arch=x86_64"
fi

info "Архитектура: $ARCH"
info "Destination: $DESTINATION"

# Выполняем сборку ТОЛЬКО для macOS
info "Выполнение сборки проекта для macOS..."
echo "Команда: xcodebuild -project \"$(basename "$XCODE_PROJECT")\" -scheme \"$SCHEME_TO_USE\" -configuration Release -destination \"$DESTINATION\" build"

xcodebuild -project "$(basename "$XCODE_PROJECT")" \
           -scheme "$SCHEME_TO_USE" \
           -configuration Release \
           -destination "$DESTINATION" \
           build

BUILD_RESULT=$?

# 5. Проверка результата и вывод сообщения
if [ $BUILD_RESULT -eq 0 ]; then
    success "✅ Сборка завершена УСПЕШНО!"
    success "Safari расширение готово в папке: $OUTPUT_DIR"
    
    # Показываем где найти собранное расширение
    APP_PATH=$(find "$OUTPUT_DIR/build/Release" -name "*.app" 2>/dev/null | head -1)
    if [ -n "$APP_PATH" ]; then
        success "Собранное приложение: $APP_PATH"
    fi
    
    # Ищем .appex (расширение Safari)
    APPEX_PATH=$(find "$OUTPUT_DIR/build" -name "*.appex" 2>/dev/null | head -1)
    if [ -n "$APPEX_PATH" ]; then
        success "Собранное расширение Safari: $APPEX_PATH"
        
        # Показываем команду для установки
        info "Для установки расширения выполните:"
        echo "open \"$APPEX_PATH\""
    else
        # Если .appex не найден, ищем в других местах
        info "Поиск собранного расширения в других местах..."
        find "$OUTPUT_DIR/build" -name "*.appex" -o -name "*.app" 2>/dev/null
    fi
    
    # Показываем содержимое папки сборки
    info "Содержимое папки build:"
    find "$OUTPUT_DIR/build" -type f -name "*.appex" -o -name "*.app" 2>/dev/null
    
else
    # Детальная отладка
    info "Детальная отладка проекта:"
    echo "Проект: $XCODE_PROJECT"
    echo "Схема: $SCHEME_TO_USE"
    echo "Destination: $DESTINATION"
    echo "Директория: $(pwd)"
    
    # Пробуем получить информацию о проекте другим способом
    info "Информация о проекте:"
    xcodebuild -list -project "$(basename "$XCODE_PROJECT")"
    
    error_exit "Сборка проекта не удалась (код ошибки: $BUILD_RESULT)"
fi