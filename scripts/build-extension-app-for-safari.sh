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

# Надежная функция проверки установки Xcode Command Line Tools
check_xcode_installation() {
    info "Проверка установки Xcode Command Line Tools..."
    
    # Способ 1: Проверка через xcode-select
    if xcode-select -p &>/dev/null; then
        # Проверяем что путь существует и не пустой
        XCODE_PATH=$(xcode-select -p 2>/dev/null)
        if [ -n "$XCODE_PATH" ] && [ -d "$XCODE_PATH" ]; then
            success "Xcode Command Line Tools найдены в: $XCODE_PATH"
            return 0
        fi
    fi
    
    # Способ 2: Проверка наличия компилятора
    if ! command -v clang &>/dev/null; then
        return 1
    fi
    
    # Способ 3: Проверка наличия инструментов разработки
    if ! pkgutil --pkg-info=com.apple.pkg.CLTools_Executables &>/dev/null; then
        return 1
    fi
    
    return 0
}

# Функция установки Xcode Command Line Tools
install_xcode_tools() {
    info "Xcode Command Line Tools не найдены. Запуск установки..."
    
    # Показываем диалог установки
    xcode-select --install
    
    # Ждем начала установки
    info "Ожидание начала установки (может занять до 30 секунд)..."
    local wait_count=0
    while [ $wait_count -lt 30 ]; do
        # Проверяем запущен ли процесс установки
        if pgrep -q "Install Command Line Developer Tools"; then
            info "Установка запущена. Ожидайте завершения..."
            break
        fi
        sleep 1
        ((wait_count++))
    done
    
    # Ждем завершения установки
    info "Ожидание завершения установки (это может занять несколько минут)..."
    
    local max_wait=600  # 10 минут максимум
    local count=0
    
    while [ $count -lt $max_wait ]; do
        if check_xcode_installation; then
            success "Xcode Command Line Tools успешно установлены!"
            return 0
        fi
        
        # Показываем прогресс каждые 30 секунд
        if [ $((count % 30)) -eq 0 ]; then
            info "Все еще ожидаем завершения установки... ($((count/60))м $((count%60))с)"
        fi
        
        sleep 1
        ((count++))
    done
    
    error_exit "Установка Xcode Command Line Tools заняла слишком много времени. Пожалуйста, установите вручную из: https://developer.apple.com/download/all/"
}

# 1. Проверка и установка Xcode Command Line Tools
if ! check_xcode_installation; then
    install_xcode_tools
else
    success "Xcode Command Line Tools уже установлены"
fi

# Дополнительная проверка наличия полной версии Xcode (опционально)
if [ -d "/Applications/Xcode.app" ]; then
    success "Xcode.app найден в /Applications/Xcode.app"
else
    info "Xcode.app не найден. Это нормально для использования только Command Line Tools"
    info "Для полной функциональности рекомендуется установить Xcode из App Store"
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
    
    if [ -z "$CONVERTER_PATH" ]; then
        # Последняя попытка - поиск в стандартных местах
        CONVERTER_PATH=$(find /Library/Developer/CommandLineTools -name "safari-web-extension-converter" -type f 2>/dev/null | head -1)
    fi
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

# Создаем временный файл для вывода конвертера
TEMP_LOG=$(mktemp)

# Запускаем конвертер и сохраняем вывод
if ! "$CONVERTER_PATH" "$EXTENSION_DIR" \
    --project-location "$OUTPUT_DIR" \
    --no-open \
    --bundle-identifier "com.cu-lms-enhancer.safari" \
    --macos-only > "$TEMP_LOG" 2>&1; then
    
    echo -e "${RED}Ошибка конвертации. Лог:${NC}"
    cat "$TEMP_LOG"
    rm -f "$TEMP_LOG"
    error_exit "Ошибка конвертации"
fi

rm -f "$TEMP_LOG"
success "Конвертация завершена успешно"

# Остальная часть скрипта остается без изменений...
# [здесь идет код сборки проекта, который уже работал корректно]

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
echo "Команда: xcodebuild -project \"$(basename \"$XCODE_PROJECT\")\" -scheme \"$SCHEME_TO_USE\" -configuration Release -destination \"$DESTINATION\" build"

if ! xcodebuild -project "$(basename "$XCODE_PROJECT")" \
           -scheme "$SCHEME_TO_USE" \
           -configuration Release \
           -destination "$DESTINATION" \
           build; then
    error_exit "Сборка проекта не удалась"
fi

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

success "🎉 Все шаги выполнены успешно!"