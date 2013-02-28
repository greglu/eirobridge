require 'bundler'
begin
  Bundler.setup(:default, :development)
rescue Bundler::BundlerError => e
  $stderr.puts e.message
  $stderr.puts "Run `bundle install` to install missing gems"
  exit e.status_code
end

require 'simplecov'
SimpleCov.start do
  add_filter 'spec'
end

require 'rspec'
require 'debugger'
require 'eirobridge'

RSpec.configure do |config|
  config.expect_with :rspec do |c|
    c.syntax = :expect
  end

  config.color_enabled  = true
  # Set RSpec to output as :documentation or :progress
  config.formatter = :documentation
end
