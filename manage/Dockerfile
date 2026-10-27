FROM python:3.12-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DEFAULT_TIMEOUT=120 \
    PIP_RETRIES=10 \
    PYTHONPATH=/app

RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql redis-server \
    && rm -rf /var/lib/apt/lists/*

ADD https://github.com/seaweedfs/seaweedfs/releases/download/4.51/linux_amd64.tar.gz /tmp/seaweedfs.tar.gz
RUN tar -xzf /tmp/seaweedfs.tar.gz -C /usr/local/bin weed && rm /tmp/seaweedfs.tar.gz

WORKDIR /app

COPY backend/requirements.txt ./requirements.txt
RUN pip install -r requirements.txt

COPY backend/ ./
COPY infrastructure/ ./infrastructure/
COPY manage/bootstrap.py manage/demo.py manage/demo_dictionaries.py manage/demo_calendar.py manage/demo_contests.py manage/demo_applications.py manage/demo_news.py ./manage/
COPY manage/s3.json /etc/fsp/s3.json
COPY manage/entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
