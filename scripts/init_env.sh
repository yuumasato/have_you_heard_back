#!/bin/bash

# To init run:
# . ./init_evn.sh

PG_USER=
PG_PASSWORD=
PG_HOST='localhost'
PG_PORT=5432
PG_DATABASE='have_you_heard'
export NODE_ENV='test'

export \
DATABASE_URL="postgres://${PG_USER}:${PG_PASSWORD}@${PG_HOST}:${PG_PORT}/${PG_DATABASE}"
