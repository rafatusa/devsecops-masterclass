variable "project_name" {
  description = "Branch-scoped project name used as the prefix for every resource."
  type        = string
}

variable "ssh_public_key" {
  description = "OpenSSH public key registered as the EC2 key pair (supplied by the platform)."
  type        = string
}

variable "region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "EC2 instance type for the Docker host."
  type        = string
  default     = "t3.micro"
}

variable "vpc_cidr" {
  description = "CIDR block for the demonstration VPC."
  type        = string
  default     = "10.20.0.0/16"
}

variable "public_subnet_cidr" {
  description = "CIDR block for the public subnet hosting the web instance."
  type        = string
  default     = "10.20.1.0/24"
}

variable "ssh_ingress_cidr" {
  description = "CIDR allowed to reach SSH (port 22) on the instance."
  type        = string
  default     = "0.0.0.0/0"
}

variable "root_volume_size" {
  description = "Size of the instance root volume in GiB."
  type        = number
  default     = 20
}
