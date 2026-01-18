#!/bin/bash
set -e

ELASTICSEARCH_URL="http://localhost:9200"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

INDEX_NAME="rockets"
ROCKET_STATE_INDEX_NAME="rockets-state"

MAPPING_FILE="$SCRIPT_DIR/mapping.json"
STATE_MAPPING_FILE="$SCRIPT_DIR/rockets-state.mapping.json"

echo "⏳ Waiting for Elasticsearch to be healthy..."
until curl -s "$ELASTICSEARCH_URL/_cluster/health" | grep -q 'status'; do
  sleep 2
done

setup_index() {
  local name=$1
  local mapping=$2

  echo "🔍 Checking if index '$name' exists..."
  local status=$(curl -s -o /dev/null -w "%{http_code}" -k "$ELASTICSEARCH_URL/$name")

  if [ "$status" -eq 200 ]; then
    echo "Index '$name' already exists."
  else
    echo "🚀 Creating index '$name' with mapping from $mapping..."
    local response=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$ELASTICSEARCH_URL/$name" \
      -H 'Content-Type: application/json' -d @"$mapping")

    if [ "$response" -eq 200 ] || [ "$response" -eq 201 ]; then
      echo "✅ Index '$name' and mapping applied successfully."
    else
      echo "❌ Failed to create index '$name'. Response code: $response"
      exit 1
    fi
  fi
}

setup_index "$INDEX_NAME" "$MAPPING_FILE"

setup_index "$ROCKET_STATE_INDEX_NAME" "$STATE_MAPPING_FILE"

echo "🏁 All indices are ready!"
