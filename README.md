# Real-time Crawlers - an interview task

### Requirements
* docker `>=23.0.5`
* docker-compose `>=2.24.6`
## How to run
To run type `docker-compose up` and the API will be exposed at the `3000` port.

## Task description

You are given an API that exposes simulated data about sport events:
1. A sport event - a match between two teams eg. `FC Barcelona vs. Real Madrid`

During a simulation the following properties of a sport event can change:
1. Score - one of the competitors can score a goal
2. Event status - when simulation starts every sport event has `PRE` status, during the simulation it is changed to `LIVE`.

The simulation runs in cycles lasting 5 minutes. After that time the state is cleaned up and
simulation starts over with new set of sport events.

Your task is to implement a TypeScript application that:
1. constantly consumes data from the simulation API using `/api/state` endpoint
2. fetches and applies mappings from the simulation API using `/api/mappings` endpoint. Mappings are used to replace unique ids with a corresponding name.
3. exposes an endpoint `/state` returning your application's internal state reflecting the current state of the ongoing simulation. The response should be in JSON format.


__For detailed information about a specific endpoint check a dedicated section below.__

#### Example response from your application should look like the following:
```json
{
  "3eccf850-571f-4e18-8cb3-2c9e3afade7b": {
    "id": "3eccf850-571f-4e18-8cb3-2c9e3afade7b",
    "status": "LIVE",
    "scores": {
      "CURRENT": {
        "type": "CURRENT",
        "home": "0",
        "away": "0"
      }
    },
    "startTime": "2024-03-04T10:36:07.812Z",
    "sport": "FOOTBALL",
    "competitors": {
      "HOME": {
        "type": "HOME",
        "name": "Juventus"
      },
      "AWAY": {
        "type": "AWAY",
        "name": "Paris Saint-Germain"
      }
    },
    "competition": "UEFA Champions League"
  }
}
```

**NOTES**:
1. your application must return a correct state for every new simulation.
2. when a sport event is finished **IT IS NOT** returned from the endpoint anymore. However, your internal state should contain the sport event with a status `REMOVED`

## API Specification

### GET /api/state
Returns a current state of the simulation.

##### Endpoint schema
```
{
    odds: string
}
```
The `odds` field contains encoded information about sport events in a current simulation cycle:
1. Events are delimited by a new line character: `\n`
1. A specific fields of an entity are delimited by a comma character `,` (check API Data format section below)

**Example response**

```JSON
{"odds":"995e0722-4118-4f8e-a517-82f6ea240673,c0a1f678-dbe5-4cc8-aa52-8c822dc65267,7ee17545-acd2-4332-869b-1bef06cfaec8,1709900432183,29190088-763e-4d1c-861a-d16dbfcf858c,3cd8eeee-a57c-48a3-845f-93b561a95782,ac68a563-e511-4776-b2ee-cd395c7dc424,\n4bb7b78f-6a23-43d0-a61a-1341f03f64e0,c0a1f678-dbe5-4cc8-aa52-8c822dc65267,194e22c6-53f3-4f36-af06-53f168ebeee8,1709900380135,d6fdf482-8151-4651-92c2-16e9e8ea4b8b,b582b685-e75c-4139-8274-d19f078eabef,7fa4e60c-71ad-4e76-836f-5c2bc6602156,e2d12fef-ae82-4a35-b389-51edb8dc664e@1:2|6c036000-6dd9-485d-97a1-e338e6a32a51@1:2\nfd903e06-9a7d-423d-8869-1c060cc0b62d,c0a1f678-dbe5-4cc8-aa52-8c822dc65267,7ee17545-acd2-4332-869b-1bef06cfaec8,1709900348483,a950b22c-989b-402f-a1ac-70df8f102e27,5dbdb683-c15f-4d79-a348-03cf2861b954,7fa4e60c-71ad-4e76-836f-5c2bc6602156,e2d12fef-ae82-4a35-b389-51edb8dc664e@1:3|6c036000-6dd9-485d-97a1-e338e6a32a51@1:3\n449a2d53-4845-4a59-9596-4206f2504656,c0a1f678-dbe5-4cc8-aa52-8c822dc65267,7ee17545-acd2-4332-869b-1bef06cfaec8,1709900494110,f0c6f8b4-8fbc-4022-95b3-c68bca32adb9,33ff69aa-c714-470c-b90d-d3883c95adce,ac68a563-e511-4776-b2ee-cd395c7dc424,\n4c6d6c9d-2b47-433d-b2ad-a82cff214805,c0a1f678-dbe5-4cc8-aa52-8c822dc65267,28cb12c0-2542-4790-b66b-e51b9cb30c76,1709900417851,4df1b17c-3bfe-4bbb-8b60-12661c2bb190,7229b223-03d6-4285-afbf-243671088a20,ac68a563-e511-4776-b2ee-cd395c7dc424,\nb874daa4-0ee2-4030-83ac-8bf70100dbb6,c72cbbc8-bac9-4cb7-a305-9a8e7c011817,28cb12c0-2542-4790-b66b-e51b9cb30c76,1709900404465,44bc5cb3-19c0-4f35-8ac6-100cfecf70f1,98841461-0442-4dbb-ae53-2e039bbecad2,7fa4e60c-71ad-4e76-836f-5c2bc6602156,e2d12fef-ae82-4a35-b389-51edb8dc664e@0:0|6c036000-6dd9-485d-97a1-e338e6a32a51@0:0\na32247cb-70a7-4d7b-a69d-37a98a512687,c72cbbc8-bac9-4cb7-a305-9a8e7c011817,194e22c6-53f3-4f36-af06-53f168ebeee8,1709900431402,9012f4c9-1d9c-4137-a60d-94b853972c7e,3138f71d-16f2-46b6-9812-d62e3fa6f981,ac68a563-e511-4776-b2ee-cd395c7dc424,\naf5d53e6-b108-48ce-b3e9-fce1c94af6c4,c72cbbc8-bac9-4cb7-a305-9a8e7c011817,7ee17545-acd2-4332-869b-1bef06cfaec8,1709900352422,259ba76d-189f-420f-be50-0aac633c2153,6acec751-8fc4-4c44-8798-1182699869d0,7fa4e60c-71ad-4e76-836f-5c2bc6602156,e2d12fef-ae82-4a35-b389-51edb8dc664e@1:1|6c036000-6dd9-485d-97a1-e338e6a32a51@1:1|2db8bc38-b46d-4bd9-9218-6f8dbe083517@0:0\n1e9d8eee-e6a7-44c2-ad21-45f6f6d0f646,c72cbbc8-bac9-4cb7-a305-9a8e7c011817,c3215a44-efdb-49fb-9f01-85b26c57bbd4,1709900497047,d34032e0-0e81-4166-8ced-dd8fd6222fcb,e476746c-869d-4aa5-a292-587730514aae,ac68a563-e511-4776-b2ee-cd395c7dc424,\nb2ec3d30-e156-42dd-9074-61681eecd382,c72cbbc8-bac9-4cb7-a305-9a8e7c011817,7ee17545-acd2-4332-869b-1bef06cfaec8,1709900423377,d3fa6d41-af8c-45d1-848c-891ca86731f1,b98bab75-53d3-494e-a3a9-b9d1dd1fb458,ac68a563-e511-4776-b2ee-cd395c7dc424,"}
```

**NOTES**:
* with every new simulation cycle a new set of sports events is served


### GET /api/mappings
Returns the dictionary used for mappings entities (sports, competitions, statuses, score types) to their unique IDs.
##### Endpoint schema

```
{
    mappings: string
}
```
The `mappings` field has the following format:

```
id1:value1;id2:value2;idN:valueN...
```
**Example response**
```
{"mappings":"29190088-763e-4d1c-861a-d16dbfcf858c:Real Madrid;33ff69aa-c714-470c-b90d-d3883c95adce:Barcelona;b582b685-e75c-4139-8274-d19f078eabef:Manchester United;4df1b17c-3bfe-4bbb-8b60-12661c2bb190:Liverpool;3cd8eeee-a57c-48a3-845f-93b561a95782:Bayern Munich;a950b22c-989b-402f-a1ac-70df8f102e27:Paris Saint-Germain;5dbdb683-c15f-4d79-a348-03cf2861b954:Juventus;7229b223-03d6-4285-afbf-243671088a20:Chelsea;d6fdf482-8151-4651-92c2-16e9e8ea4b8b:Manchester City;f0c6f8b4-8fbc-4022-95b3-c68bca32adb9:AC Milan;6acec751-8fc4-4c44-8798-1182699869d0:Los Angeles Lakers;9012f4c9-1d9c-4137-a60d-94b853972c7e:Golden State Warriors;44bc5cb3-19c0-4f35-8ac6-100cfecf70f1:Miami Heat;e476746c-869d-4aa5-a292-587730514aae:Chicago Bulls;259ba76d-189f-420f-be50-0aac633c2153:Boston Celtics;98841461-0442-4dbb-ae53-2e039bbecad2:Houston Rockets;3138f71d-16f2-46b6-9812-d62e3fa6f981:Toronto Raptors;b98bab75-53d3-494e-a3a9-b9d1dd1fb458:Dallas Mavericks;d3fa6d41-af8c-45d1-848c-891ca86731f1:Brooklyn Nets;d34032e0-0e81-4166-8ced-dd8fd6222fcb:Denver Nuggets;c3215a44-efdb-49fb-9f01-85b26c57bbd4:UEFA Champions League;7ee17545-acd2-4332-869b-1bef06cfaec8:UEFA Europa League;28cb12c0-2542-4790-b66b-e51b9cb30c76:NBA;194e22c6-53f3-4f36-af06-53f168ebeee8:NBA - pre-season;c0a1f678-dbe5-4cc8-aa52-8c822dc65267:FOOTBALL;c72cbbc8-bac9-4cb7-a305-9a8e7c011817:BASKETBALL;ac68a563-e511-4776-b2ee-cd395c7dc424:PRE;7fa4e60c-71ad-4e76-836f-5c2bc6602156:LIVE;cb807d14-5a98-4b41-8ddc-74a1f5f80f9b:REMOVED;e2d12fef-ae82-4a35-b389-51edb8dc664e:CURRENT;6c036000-6dd9-485d-97a1-e338e6a32a51:PERIOD_1;2db8bc38-b46d-4bd9-9218-6f8dbe083517:PERIOD_2;0cfb491c-7d09-4ffc-99fb-a6ee0cf5d198:PERIOD_3;5a79d3e7-85b3-4d6b-b4bf-ddd743e7162f:PERIOD_4"}
```
**NOTES**:
* mappings get new IDs every time a new turn of simulation is started.

## API Data format

### Event

| Position | Value                 | Note                                                                                         |
|----------|-----------------------|----------------------------------------------------------------------------------------------|
| 0        | Sport Event ID        |
| 1        | Sport ID              |
| 2        | Competition ID        |
| 3        | Start time            |
| 4        | Home Competitor ID    |
| 5        | Away Competitor ID    |
| 6        | Sport Event Status ID |
| 7        | Scores                | Score periods are delimited by `\|` character and have `period@home_score:away_score` format |


### Environment variables

| Name | Description | Default value |
| ---- | ------ |---------------|
| RTC_SIMULATION_API_PORT | A port to expose API to | 3000          |
| RTC_SIMULATION_ROOT_PATH | A path prefix to expose endpoints | /api          |
| RTC_SIMULATION_DURATION_MIN | A duration of a single simulation in minutes | 5             |


