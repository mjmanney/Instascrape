//  Post constructor

class Post {
  constructor(owner, shortcode, src, caption, likes, comments, epoch_sec, width, height) {
    this.owner     = owner
    this.shortcode = shortcode
    this.src       = src
    this.caption   = caption
    this.likes     = likes
    this.comments  = comments
    this.epoch_sec = epoch_sec
    this.width     = width
    this.height    = height
  }

  get score () {
    return parseInt(this.likes) + parseInt(this.comments)
  }

  get OP () {
    // gets the link to the orignal post
    return 'https://www.instagram.com/p/' + this.shortcode
  }

  get dimensions () {
    return {
      height: this.height,
      width:  this.width
    }
  }

  get timestamp () {
    return new Date(this.epoch_sec * 1000).toUTCString()
  }
}

//  Once all images are done loading, add them to the DOM

function appendPostsToGrid (posts) {
  var allPosts = []

  function promisePost (post) {
    return new Promise((resolve, reject) => {
      var img     = new Image()
      $(img).attr('data-index', post.index)
      img.onload  = () => resolve(img)
      img.onerror = () => reject(new Error('Unable to load img' + img))
      img.src     = post.src
    })
  }

  $.each(posts, (i, post) => {
    post.index = i
    allPosts.push(promisePost(post))
  })

  Promise.all(allPosts)
  .then(images => {
    $.each(images, (i, img) => {
      $(img).hide()
      $('.photo-grid').append(img)
      $(img).fadeIn(2000, 'linear')
    })
  })
  .catch(e => console.error(e))
  .finally(() => {
    $('body').css('background-image', 'none')
    $('body').css('background-color', '#333333')
    $('.heading').fadeOut(2000)
    $('.loading').fadeOut(1000)
  })
}

//  HTTP Request to Instagram
function jqXHR () {
  var request = {
    url:        '',
    success:    onSuccess,
    error:      onError,
    statusCode: statusCodeHandler
  }

  var query = {
    tag_name: main.tag,
    first:    3,
    after:    main.cursor
  }

  var modifiedUrl = main.cursor === '' ?
                    main.url.initial + main.tag + "/?__a=1"     :
                    main.url.subsequent + JSON.stringify(query) ;

  request.url = modifiedUrl
  $.get(request)
}

// Holds information relevant to the request and stores the posts

var main = {
  url: {
    initial:    'https://instagram.com/explore/tags/',
    subsequent: 'https://www.instagram.com/graphql/query/?query_hash=ded47faa9a1aaded10161a2ff32abb6b&variables='
  },
  tag:    '',
  cursor: '',
  posts:  [],
  setTag: function (newTag) { this.tag = newTag },
}

// HTTP request callbacks and handlers

function onError (error) {
  console.error('An error occured.')
  console.error(error)
}

function onSuccess (data, statusCode, jqXHR) {
  var media      = data.data ?
                   data.data.hashtag.edge_hashtag_to_media    :
                   data.graphql.hashtag.edge_hashtag_to_media ;
  var cursor     = media.page_info.end_cursor
  var images     = media.edges
  var count      = media.count
  var isLastPage = !media.page_info.has_next_page

  main.cursor    = cursor

  if(isLastPage || main.cursor === null) {
    $('#load-next').prop('disabled', true)
    return
  }
  else {
    $('#load-next').prop('disabled', false)
  }

  $.each(images, (i, image) => {
    var node      = image.node
    var width     = node.dimensions.width
    var height    = node.dimensions.height
    var likes     = node.edge_liked_by.count
    var caption   = node.edge_media_to_caption.edges[0] ?
                    node.edge_media_to_caption.edges[0].node.text : '';
    var comments  = node.edge_media_to_comment.count
    var owner     = node.owner.id
    var epoch_sec = node.taken_at_timestamp
    var shortcode = node.shortcode
    var src       = node.display_url

    var post = new Post(owner, shortcode, src, caption, likes, comments, epoch_sec, width, height)
    main.posts.push(post)
  })
  appendPostsToGrid(main.posts)
}

function onStatusCode200 () {
  console.log('200: Response OK.')
}

function onStatusCode403 () {
  // This occurs if I try to load more resources after the
  // initial request
  console.error('403: Forbidden request.')
}

function onStatusCode404 () {
  console.error('404: Not found.  Hashtag should be part of url not as query parameter.')
}

function onStatusCode429 () {
  console.error('429: Rate limited.  Too many requests, try again later.')
}

var statusCodeHandler = {
  200: onStatusCode200,
  403: onStatusCode403,
  404: onStatusCode404,
  429: onStatusCode429,
}

//  Clicking the search button initates the request

$('#search').click(() => {
  if(main.tag === '') {
    var tag = $('#user-input').val().trim()
    if(tag) {
      $('.loading').css('display', 'block')
      main.setTag(tag)
      jqXHR()
    }
  }
})

// TODO Implement load more feature
// Currently recieve 403 error when requesting more
// Tom's article mentions a POST request but technique has changed
// I am unsure if it is related to CSRF token
//$('#load-next').click(jqXHR)

//  Handles events related to the images
//  TODO clean up

$('.photo-grid').on('mouseenter', 'img', event => {
  var self = event.target
  $(self).animate({
    opacity: 1
  }, 800)
}).on('mouseleave', 'img', event => {
  var self = event.target
  $(self).animate({
    opacity: 0.25
  }, 800)
}).on('click', 'img', event => {
  var self = event.target
  var post = main.posts[$(self).attr('data-index')]
  var timestamp = post.timestamp
  var op        = post.OP
  var caption   = post.caption ? post.caption : 'no caption'
  var score     = post.score
  var likes     = post.likes

  if(caption) {
    caption = caption.length > 140 ? caption.slice(0, 180) + '...' : caption
  }

  $('#focusImg').prop('src', post.src)
  $('.likes').html(likes == 1 ? likes + ' like' : likes + ' likes')
  $('.score').html(score + ' likes & comments')
  $('.caption').html(caption)
  $('.timestamp').html('photo taken on ' + timestamp)

  $('.op').prop('href', op)

  $('.modal').css('display', 'block')
  $('body').css('overflow', 'hidden')
})

$('.modal').on('click',  event => {
  $('.modal').css('display', 'none')
  $('#focusImg').prop('src', '')
  $('body').css('overflow', 'initial')
})
