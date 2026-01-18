# 🪐 Rockets 🚀

This system is designed to consume real-time telemetry from multiple rockets, process state changes (speed updates, mission changes, explosions), 
and provide a clean REST API for a monitoring dashboard.


# Architecture

Below is an architecture that i thought will fit with my prioritization within 6 hours

[A better architecture is mentioned here](#a-better-architecture)

![Arch](assets/arch.png)

The solution is built as a NestJS Monorepo, utilizing an event-driven architecture to handle high-volume telemetry data with eventual consistency.

## Ingestion API (messages-service) 
Receives high-frequency POST requests from rockets and queues them in Amazon SQS (via LocalStack).

## Message Consumer (rockets-message-consumer)
A function that consumes SQS messages. It stores the messages keeping the (at-least once) in mind

## Dashboard API (rockets)
Provides REST endpoints to query the latest state and perform complex searches across the fleet.

## Storage (Elasticsearch)
Used for high-speed indexing and aggregations.

# Getting Started
This section demos how to run the solution in Dev Env. Apologies for not having a production build did not fit within the 6 hour limit


## Prerequisites
* Node.js (v20+) ~ tested on 24.13.0
* Docker & Docker Compose
* The rockets test executable
* awscli-local
* @nestjs/cli _optional_

### Installations

```shell
npm install
```

```shell
# Optional
npm install -g @nestjs/cli
```

```shell
pip install awscli-local
```

### Running the services

```shell
npm run start rockets --watch
```

```shell
npm run start messages-service --watch
```

```shell
npm run infra:up
```

### Processing the data

```shell
./rockets launch "http://localhost:8088/messages" --message-delay=500ms --concurrency-level=1
```

At this point you will start processing the messages

your terminal can look like
![Terminal](assets/terminal-session.png)

### API Endpoints ~ Swagger

Now you can go to [Swagger](http://localhost:8089/api)

![Swagger](assets/swagger.png)

### Accessing the data in Elasticsearch ~ Kibana

You can also access kibana rockets [indice here](http://localhost:5601/app/elasticsearch/index_management/indices)

![Kibana](assets/kibana.png)

### Lambda Logs
You can view the lambda logs using the command below

```shell
docker compose logs -f localstack | grep -E "lambda|rockets-message-consumer"
```

# Testing

## Unit Tests

```shell
npm run test
```

![Unit Tests](assets/unit-test.png)
## E2E Tests

```shell
npm run test:e2e
```
![E2E Tests](assets/e2e.png)


# Key Technical Considerations

## Out-of-Order Messages
The system uses `messageNumber` and `rocketUuid` within the Stateful Indexing logic to ensure that late-arriving messages do not overwrite newer data.

## Search Performance
The POST /search endpoint utilizes the searchByProperty method to perform efficient document filtering via bool.must queries and deterministic sorting, 
ensuring specific telemetry data is retrieved without manual client-side processing

# A better Architecture

The services in this project are slightly tightly coupled as there is a single sqs in the `messages-service`
so better arch will be 

![Better Arch](assets/better-arch.png)

This allows

1. Decouple the services
2. Easy addition of downstream systems
3. Use the default behaviour of dynamodb to deduplicate events
4. Event replay will be easier
5. Avoid the split-brain scenarios that can happen in elasticsearch


# Limitations
* There is no way to re-drive messages as no `dlq` was setup
* Given the amount of data in a production env i will vote to using kinesis for streaming instead of sqs

# Known Issues
* There is a hard limit of `size: 1000` set on the elastic search queries which can be resolved with either [Composite Aggregation](https://www.elastic.co/docs/reference/aggregations/search-aggregations-bucket-composite-aggregation) or normal pagination using the `search_after`  

# Production & Scalability Considerations
To transition this proof-of-concept into a production-grade system for a high-concurrency environment consider the following

## Data Integrity & Consistency

### Optimistic Concurrency
In a high-concurrency distributed system, SQS retries or parallel Lambda 
executions can lead to race conditions.
I would implement Elasticsearch's if_seq_no and if_primary_term on 
state updates to ensure that a stale process does not overwrite a newer state update.


### Idempotency
While messageNumber guards against old data, 
a true idempotent consumer would store a hash of the processed SQS messageId 
in a fast-access cache (like Redis) or an Elasticsearch field or DynamoDB
to prevent re-processing logic for successfully completed events.

## Resilience

To protect the Dashboard API, I would implement circuit breakers on the Elasticsearch client. If the cluster becomes unresponsive, 
the API should fail fast or serve stale data from a cache

## Observability (SLIs/SLOs)

### Distributed Tracing and alerts
I would use something like NewRelic traceability feature or the like to trace events 
from inception till its processed in the last downstream service.
I would also add alerts starting with bottlenecks on the messages-service stream, health fo the elasticsearch

### Synthetic Monitoring
I will add a synthetic monitor for the elasticsearch help and he service endpoints

