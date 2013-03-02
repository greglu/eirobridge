# -*- encoding: utf-8 -*-
lib = File.expand_path('../lib', __FILE__)
$LOAD_PATH.unshift(lib) unless $LOAD_PATH.include?(lib)
require 'eirobridge/version'

Gem::Specification.new do |gem|
  gem.name          = "eirobridge"
  gem.version       = Eirobridge::VERSION
  gem.authors       = ["Greg Lu"]
  gem.email         = ["greg.lu@where.com"]
  gem.description   = %q{}
  gem.summary       = %q{}
  gem.homepage      = "https://github.com/greglu/eirobridge"

  gem.files         = `git ls-files`.split($/)
  gem.executables   = gem.files.grep(%r{^bin/}).map{ |f| File.basename(f) }
  gem.test_files    = gem.files.grep(%r{^(test|spec|features)/})
  gem.require_paths = ["lib"]

  gem.add_development_dependency("rake")
  gem.add_development_dependency("debugger")
  gem.add_development_dependency("rspec")
  gem.add_development_dependency("simplecov")
  gem.add_development_dependency("oj")
end
