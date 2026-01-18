#!/bin/sh
echo "Configuring SQS Queue..."
awslocal sqs create-queue --queue-name rocket-messages-queue

echo "Setup Complete"
