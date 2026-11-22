# Desa Pinarak — server Go (multi-stage).
# Konteks build = ROOT proyek (lihat docker-compose.yml) supaya tahap
# akhir bisa menyalin folder public/ klien yang tidak berubah.
#
# Tahap 1: build binary Go statis (CGO_ENABLED=0).
FROM golang:1.23-alpine AS build
WORKDIR /src
COPY goserver/go.mod goserver/go.sum ./
RUN go mod download
COPY goserver/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /pinarak ./cmd/server

# Tahap 2: image kecil berisi binary + public/, jalan non-root.
FROM alpine:3.20
RUN adduser -D -u 10001 pinarak
WORKDIR /app
COPY --from=build /pinarak /app/pinarak
COPY public/ /app/public/
USER pinarak
EXPOSE 8026
CMD ["/app/pinarak"]
