from setuptools import setup, find_packages

with open("requirements.txt") as f:
	install_requires = f.read().strip().split("\n")

setup(
	name="wa_calling_client",
	version="0.0.1",
	description="WhatsApp Calling Client - Lightweight client app for WhatsApp calling integration",
	author="Your Company",
	author_email="info@yourcompany.com",
	packages=find_packages(),
	zip_safe=False,
	include_package_data=True,
	install_requires=install_requires
)
