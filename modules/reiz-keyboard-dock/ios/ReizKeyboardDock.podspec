Pod::Spec.new do |s|
  s.name           = 'ReizKeyboardDock'
  s.version        = '1.0.0'
  s.summary        = 'Barre de message collée au clavier'
  s.description    = "Une vue qui suit le clavier image par image, y compris quand on le fait descendre au doigt."
  s.author         = 'Reiz'
  s.homepage       = 'https://reiz-landing.netlify.app'
  s.license        = 'UNLICENSED'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = "**/*.{h,m,swift}"
end
