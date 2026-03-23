FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/srv/app/backend

WORKDIR /srv/app

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend ./backend
COPY seeds ./seeds

RUN chmod +x backend/entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["./backend/entrypoint.sh"]
