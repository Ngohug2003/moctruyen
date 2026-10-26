# Application boundary

`main.py` assembles the app, exception handlers, CORS, routers and lifespan. Importing the package must not connect to a database, create tables, run imports or start tasks. Dispose the async engine during shutdown. Keep framework wiring here and feature behavior in the layers below. Create modules only for concrete responsibilities; avoid empty feature scaffolds.
