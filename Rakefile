#!/usr/bin/env rake

require "bundler/gem_tasks"
Bundler::GemHelper.install_tasks

require 'rspec/core/rake_task'
RSpec::Core::RakeTask.new(:spec)
desc "Run specs"
task :default => :spec

desc "Open an irb session preloaded with this library"
task :console do
  sh "bundle exec irb -rubygems -r ./lib/eirobridge.rb -r debugger"
end
