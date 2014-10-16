ruminant
========

```javascript
var ruminant = require('ruminant');
var r = ruminant({
  pool: ...,
  dir: path.join(__dirname, 'procedures')
});

r.init()
  .then(function () {
    // r.one('name', ...) === r.first('name', ...)
    // r.all('name', ...) === r.call('name', ...)
    return r.call('name', arg1, arg2);
  })
```

```sql
CREATE PROCEDURE `{{ name }}`()...
```
