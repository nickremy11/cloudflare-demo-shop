# Minimal traffic-generator image. Pairs with a separate Selenium browser
# container (e.g. selenium/standalone-chrome) over the Selenium grid URL.
# Build:
#   docker build -t cssgen-traffic .
# Run (remote driver in docker-compose):
#   docker run --rm \
#     -e TARGET_URL=https://remydemo.com/client-side-security/checkout \
#     -e SELENIUM_URL=http://selenium:4444/wd/hub \
#     --network demo-net \
#     cssgen-traffic
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY generate_traffic.py ./

ENTRYPOINT ["python", "/app/generate_traffic.py"]
