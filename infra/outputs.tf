output "public_ip" {
  description = "Elastic IP of the Docker host — consumed by the configure and verify stages."
  value       = aws_eip.web.public_ip
}

output "app_url" {
  description = "Public URL of the landing page."
  value       = "http://${aws_eip.web.public_ip}"
}

output "instance_id" {
  description = "EC2 instance id of the Docker host."
  value       = aws_instance.web.id
}

output "vpc_id" {
  description = "Id of the demonstration VPC."
  value       = aws_vpc.main.id
}

output "subnet_id" {
  description = "Id of the public subnet."
  value       = aws_subnet.public.id
}

output "security_group_id" {
  description = "Id of the web security group."
  value       = aws_security_group.web.id
}

output "iam_role_name" {
  description = "Name of the EC2 instance role."
  value       = aws_iam_role.web.name
}

output "ami_id" {
  description = "Ubuntu AMI the instance was launched from."
  value       = data.aws_ami.ubuntu.id
}
