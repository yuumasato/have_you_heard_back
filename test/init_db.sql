CREATE TABLE pt_headlines (
    id SERIAL,
    link VARCHAR(255),
    headline VARCHAR(255),
    PRIMARY KEY (id)
);

CREATE TABLE es_headlines (
    id SERIAL,
    link VARCHAR(255),
    headline VARCHAR(255),
    PRIMARY KEY (id)
);

\COPY es_headlines(link, headline) FROM 'data/es.csv' DELIMITER ',' CSV HEADER;
\COPY pt_headlines(link, headline) FROM 'data/pt.csv' DELIMITER ',' CSV HEADER;
