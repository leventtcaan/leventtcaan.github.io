document.addEventListener('DOMContentLoaded', () => {
    
    /* =========================================
       Mobile Navigation Menu (Hamburger)
       ========================================= */
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    const navItems = document.querySelectorAll('.nav-links a');
    
    // Toggle Menu on Click
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navLinks.classList.toggle('active');
        // Prevent scrolling on body when menu is open
        document.body.style.overflow = navLinks.classList.contains('active') ? 'hidden' : 'auto';
    });
    
    // Close Menu when a link is clicked
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            hamburger.classList.remove('active');
            navLinks.classList.remove('active');
            document.body.style.overflow = 'auto'; // Re-enable scrolling
        });
    });

    /* =========================================
       Navbar Scroll Logic (Hide/Show & Shadow)
       ========================================= */
    const navbar = document.getElementById('navbar');
    let lastScrollTop = 0;
    
    window.addEventListener('scroll', () => {
        let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // Add shadow/glass effect if scrolled down a bit
        if (scrollTop > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
        
        // Hide navbar on scroll down, show on scroll up
        if (scrollTop > lastScrollTop && scrollTop > 100) {
            // Scrolling down & passed header
            navbar.classList.add('hidden-nav');
        } else {
            // Scrolling up
            navbar.classList.remove('hidden-nav');
        }
        
        lastScrollTop = scrollTop;
    }, { passive: true }); // passive true for better scoll performance

    /* =========================================
       Intersection Observer for Scroll Animations
       ========================================= */
    const revealElements = document.querySelectorAll('.reveal');
    
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                // Optional: Stop observing once revealed to only animate once
                observer.unobserve(entry.target);
            }
        });
    }, {
        root: null,
        rootMargin: '0px 0px -100px 0px', // Trigger slightly before element enters view
        threshold: 0.15 // 15% of element is visible
    });
    
    revealElements.forEach(el => {
        revealObserver.observe(el);
    });

    /* =========================================
       Active Link Highlighting on Scroll
       ========================================= */
    const sections = document.querySelectorAll('section');
    
    window.addEventListener('scroll', () => {
        let current = '';
        const scrollPosition = window.scrollY;
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            
            // Offset for fixed header
            if (scrollPosition >= (sectionTop - 150)) {
                current = section.getAttribute('id');
            }
        });
        
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('href') === `#${current}`) {
                item.classList.add('active');
            }
        });
    }, { passive: true });

});
