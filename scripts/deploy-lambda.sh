#!/bin/bash
set -e

echo "📦 Packaging Lambda... it might take a while"
rm -f consumer.zip
rm -rf dist
npm install

nest build rockets-message-consumer --tsc
cp apps/rockets-message-consumer/package.lambda.json \
   dist/apps/rockets-message-consumer/package.json

cd dist/apps/rockets-message-consumer/
npm install --omit=dev

zip -r ../../../consumer.zip .
cd ../../../
echo "🚀 Deploying lambda to LocalStack..."

awslocal lambda delete-function --function-name rockets-message-consumer > /dev/null 2>&1 || true

MAPPING_UUID=$(awslocal lambda list-event-source-mappings \
  --function-name rockets-message-consumer \
  --query "EventSourceMappings[0].UUID" --output text)

if [ "$MAPPING_UUID" != "None" ] && [ -n "$MAPPING_UUID" ]; then
  echo "🗑️ Removing existing Event Source Mapping: $MAPPING_UUID"
  awslocal lambda delete-event-source-mapping --uuid "$MAPPING_UUID" > /dev/null 2>&1 || true
fi

awslocal lambda create-function \
  --function-name rockets-message-consumer \
  --runtime nodejs20.x \
  --handler apps/rockets-message-consumer/src/main.handler \
  --zip-file fileb://consumer.zip \
  --timeout 60 \
  --memory-size 1000 \
  --role arn:aws:iam::000000000000:role/lambda-role \
  --environment "Variables={ELASTICSEARCH_URL=http://elasticsearch:9200}" \
  --no-cli-pager > /dev/null

echo "⏳ Waiting for Lambda to become 'Active'..."

awslocal lambda wait function-active --function-name rockets-message-consumer

echo "🔗 Function active. Creating SQS Event Source Mapping..."

awslocal lambda create-event-source-mapping \
  --function-name rockets-message-consumer \
  --event-source-arn arn:aws:sqs:us-east-1:000000000000:rocket-messages-queue \
  --no-cli-pager > /dev/null

echo "✅ Deployment complete! Lambda is now listening to SQS."
