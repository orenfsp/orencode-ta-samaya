import asyncio
import io
from datetime import timedelta
from urllib.parse import quote, urlparse

from minio import Minio
from minio.commonconfig import CopySource

from core.config import Settings

REGION = "us-east-1"


class ObjectRepository:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client = Minio(
            settings.s3_endpoint,
            access_key=settings.s3_access_key,
            secret_key=settings.s3_secret_key,
            secure=False,
            region=REGION,
        )
        public = urlparse(settings.s3_public_url)
        self._signer = Minio(
            public.netloc,
            access_key=settings.s3_access_key,
            secret_key=settings.s3_secret_key,
            secure=public.scheme == "https",
            region=REGION,
        )

    @property
    def public_bucket(self) -> str:
        return self._settings.s3_public_bucket

    @property
    def private_bucket(self) -> str:
        return self._settings.s3_private_bucket

    def bucket(self, is_public: bool) -> str:
        return self.public_bucket if is_public else self.private_bucket

    def public_url(self, key: str) -> str:
        return f"{self._settings.s3_public_url}/{self.public_bucket}/{quote(key)}"

    async def put(self, is_public: bool, key: str, data: bytes, content_type: str) -> None:
        await asyncio.to_thread(
            self._client.put_object, self.bucket(is_public), key, io.BytesIO(data), len(data), content_type
        )

    async def move(self, key: str, to_public: bool) -> None:
        source, target = self.bucket(not to_public), self.bucket(to_public)
        await asyncio.to_thread(self._client.copy_object, target, key, CopySource(source, key))
        await asyncio.to_thread(self._client.remove_object, source, key)

    async def signed_url(self, key: str, filename: str, ttl_seconds: int) -> str:
        disposition = f"inline; filename*=UTF-8''{quote(filename)}"
        return await asyncio.to_thread(
            self._signer.presigned_get_object,
            self.private_bucket,
            key,
            expires=timedelta(seconds=ttl_seconds),
            response_headers={"response-content-disposition": disposition},
        )

    async def ensure_buckets(self, attempts: int = 60) -> None:
        for attempt in range(attempts):
            try:
                for bucket in (self.public_bucket, self.private_bucket):
                    if not await asyncio.to_thread(self._client.bucket_exists, bucket):
                        await asyncio.to_thread(self._client.make_bucket, bucket)
                return
            except Exception:
                if attempt == attempts - 1:
                    raise
                await asyncio.sleep(1)
