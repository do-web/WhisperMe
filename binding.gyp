{
  "targets": [
    {
      "target_name": "fn_monitor",
      "sources": ["native/fn_monitor.cc"],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
      "conditions": [
        ["OS=='mac'", {
          "link_settings": {
            "libraries": [
              "-framework ApplicationServices",
              "-framework CoreFoundation"
            ]
          }
        }]
      ]
    }
  ]
}
